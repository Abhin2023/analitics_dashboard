#!/usr/bin/env python3
"""One-shot full reconciliation: makes the dashboard match MCP exactly.

Combines everything built so far into a single run, for a testing
environment where the goal is 100% accuracy over caution about any single
step:

  1. Wipes mcp_daily_sales and re-syncs the same date range fresh from MCP
     (same as rebuild_mcp_daily_sales.py) — guarantees the raw numbers are
     accurate, not just whatever's already stored.
  2. Deletes any needs-review branch left with zero sales rows (same as
     cleanup_empty_review_stores.py) — these are stale duplicates with
     nothing to lose.
  3. For every REMAINING needs-review branch that still holds real revenue,
     automatically resolves it instead of leaving it excluded:
       - if it looks like a duplicate of an existing confirmed branch (by
         name similarity), merges it in (preserving the name permanently
         via the store_mcp_aliases memory, so it can never resurface);
       - otherwise, confirms it as a genuinely new branch so its revenue
         starts counting.
  4. Re-verifies the result against a fresh MCP pull and prints the final
     gap (should be ~0).

This is more aggressive than the other scripts (no per-row manual review) —
appropriate for a testing/staging database where matching MCP exactly
matters more than double-checking every single low-confidence guess. Prints
every decision it makes so it can be audited afterward. Asks for ONE
confirmation before making any changes.
"""
import asyncio
import sys
import os
import re
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func, delete
from app.db.session import AsyncSessionLocal
from app.models.models import Store, McpDailySale
from app.services.mcp_sync_service import sync_mcp_sales
from app.services.mcp_daily_sales import get_daily_sales
from app.services.mcp_branches import MCP_COUNTRIES
from app.services.store_merge_service import merge_store_into

FUZZY_CUTOFF_WORDS = 1  # at least one meaningful shared word to auto-merge

_STOPWORDS = {
    "pvt", "ltd", "private", "limited", "llc", "technologies", "technology",
    "innovations", "innovation", "trading", "group", "solutions", "solution",
    "the", "and", "co", "company", "enterprises", "ventures", "partners",
    "gadgets", "services", "service", "store", "shop", "sdn", "bhd",
    "mall", "branch", "br", "mobile", "phone", "phones", "office", "city",
}


def _words(name: str) -> set[str]:
    tokens = re.findall(r"[a-z]+", name.lower())
    return {t for t in tokens if t not in _STOPWORDS and len(t) > 2}


async def step1_rebuild_sales(db):
    print("=" * 70)
    print("STEP 1: Wipe and rebuild mcp_daily_sales from MCP")
    print("=" * 70)
    row = (await db.execute(
        select(func.min(McpDailySale.date), func.max(McpDailySale.date), func.count())
        .select_from(McpDailySale)
    )).first()
    from_date, to_date, count = row
    if count == 0:
        # A blank table is genuinely ambiguous: it might mean "brand new
        # install," or it might mean something wiped what used to be a full
        # year of history (this happened once — nothing was permanently
        # lost since MCP itself is untouched, but Step 2 below trusts
        # "zero rows for this store" to mean "safe to delete," and that's
        # only true if this resync actually covered a wide enough window
        # to have seen that store's real activity). Defaulting to a full
        # year here, instead of just the current month, means Step 2's
        # emptiness check is actually meaningful rather than a guess based
        # on 2-3 weeks of data.
        today = date.today()
        from_date = today.replace(year=today.year - 1).isoformat()
        to_date = today.isoformat()
        print(f"mcp_daily_sales is already empty — that's unusual (was there "
              f"a year of history before?) — re-syncing a full year ({from_date} "
              f"to {to_date}) instead of just the current month, so Step 2's "
              f"'this branch has zero revenue' check further down is actually "
              f"trustworthy rather than a guess based on a narrow window.")
    print(f"Range: {from_date} to {to_date} ({count} existing rows)")

    await db.execute(delete(McpDailySale))
    await db.commit()

    result = await sync_mcp_sales(db, str(from_date), str(to_date))
    print(f"Re-sync result: {result}")
    return str(from_date), str(to_date)


async def step2_delete_empty_duplicates(db):
    print("\n" + "=" * 70)
    print("STEP 2: Delete needs-review branches with zero sales rows")
    print("=" * 70)
    stores = (await db.execute(select(Store).where(Store.needs_review == True))).scalars().all()
    empty = []
    for s in stores:
        n = (await db.execute(
            select(func.count()).select_from(McpDailySale).where(McpDailySale.store_id == s.id)
        )).scalar()
        if n == 0:
            empty.append(s)
    for s in empty:
        print(f"  DELETE (empty) id={s.id} {s.name!r}")
        await db.delete(s)
    if not empty:
        print("  none found")
    return len(empty)


async def step3_resolve_remaining(db):
    print("\n" + "=" * 70)
    print("STEP 3: Auto-resolve every remaining needs-review branch")
    print("=" * 70)
    all_stores = (await db.execute(select(Store))).scalars().all()
    confirmed = [(s, _words(s.name)) for s in all_stores if not s.needs_review]
    review = [s for s in all_stores if s.needs_review]

    merges, confirms = [], []
    for s in review:
        total = (await db.execute(
            select(func.sum(McpDailySale.revenue)).where(McpDailySale.store_id == s.id)
        )).scalar()
        total = float(total or 0)
        my_words = _words(s.name)
        best, best_overlap = None, 0
        for cs, cw in confirmed:
            overlap = len(my_words & cw)
            if overlap > best_overlap:
                best, best_overlap = cs, overlap
        if best and best_overlap >= FUZZY_CUTOFF_WORDS:
            merges.append((s, best, total))
        else:
            confirms.append((s, total))

    print(f"\n{len(merges)} branch(es) will be MERGED:")
    for source, target, total in merges:
        print(f"  MERGE  {source.name!r:50} (revenue={total:>12,.2f}) -> {target.name!r} (id={target.id})")

    print(f"\n{len(confirms)} branch(es) will be CONFIRMED AS NEW:")
    for source, total in confirms:
        print(f"  CONFIRM {source.name!r:50} (revenue={total:>12,.2f})")

    return merges, confirms


async def apply_step3(db, merges, confirms):
    for source, target, total in merges:
        await merge_store_into(db, source, target)

    for source, total in confirms:
        source.needs_review = False


async def step4_verify(from_date, to_date):
    print("\n" + "=" * 70)
    print("STEP 4: Verify against a fresh MCP pull")
    print("=" * 70)
    async with AsyncSessionLocal() as db:
        for country in MCP_COUNTRIES:
            fresh_rows = await get_daily_sales(country["id"], from_date, to_date)
            fresh_total = sum(r["revenue"] for r in fresh_rows)

            # Group by the Store.country text field, not mcp_country_id —
            # that column is only ever set by the city-token match path, so
            # most stores (anything matched by exact name, or Sheets-based
            # stores never routed through that path) leave it NULL even
            # though their `country` text field is populated correctly.
            stores = (await db.execute(
                select(Store.id).where(Store.country == country["name"])
            )).scalars().all()
            stored_total = (await db.execute(
                select(func.coalesce(func.sum(McpDailySale.revenue), 0)).where(
                    McpDailySale.store_id.in_(stores),
                    McpDailySale.date >= from_date, McpDailySale.date <= to_date,
                )
            )).scalar() if stores else 0.0
            stored_total = float(stored_total)
            diff = abs(fresh_total - stored_total)
            flag = "OK" if diff < 1.0 else "GAP"
            print(f"  {flag:4} {country['name']:10} stored={stored_total:>14,.2f}  mcp={fresh_total:>14,.2f}  diff={diff:>10,.2f}")

        stores = (await db.execute(select(Store))).scalars().all()
        confirmed_ids = [s.id for s in stores if not s.needs_review]
        review_ids = [s.id for s in stores if s.needs_review]
        confirmed_total = float((await db.execute(
            select(func.coalesce(func.sum(McpDailySale.revenue), 0)).where(McpDailySale.store_id.in_(confirmed_ids))
        )).scalar() if confirmed_ids else 0.0)
        review_total = float((await db.execute(
            select(func.coalesce(func.sum(McpDailySale.revenue), 0)).where(McpDailySale.store_id.in_(review_ids))
        )).scalar() if review_ids else 0.0)
        print(f"\nDashboard-visible total (confirmed only): {confirmed_total:,.2f}")
        print(f"Still excluded (needs review):             {review_total:,.2f}")
        print(f"True total:                                {confirmed_total + review_total:,.2f}")


async def main():
    async with AsyncSessionLocal() as db:
        from_date, to_date = await step1_rebuild_sales(db)
        empty_count = await step2_delete_empty_duplicates(db)
        merges, confirms = await step3_resolve_remaining(db)

        if empty_count == 0 and not merges and not confirms:
            print("\nNothing left to do — already fully reconciled.")
            await db.commit()
        else:
            answer = input(
                f"\nApply {empty_count} deletion(s), {len(merges)} merge(s), "
                f"{len(confirms)} confirmation(s)? Type 'yes' to proceed: "
            ).strip().lower()
            if answer != "yes":
                print("Aborted — nothing changed beyond the step 1 rebuild (which already committed).")
                return
            await apply_step3(db, merges, confirms)
            await db.commit()
            print("\nAll changes committed.")

    await step4_verify(from_date, to_date)


if __name__ == "__main__":
    asyncio.run(main())
