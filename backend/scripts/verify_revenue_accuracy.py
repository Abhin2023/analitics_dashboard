#!/usr/bin/env python3
"""Verifies revenue accuracy on the LIVE system, in two parts:

PART 1 — Data accuracy check: re-fetches the current month fresh from MCP for
every country and compares it against what's currently stored in
mcp_daily_sales, to confirm the stored numbers still match the real source
(no drift, no leftover truncation).

PART 2 — Dashboard accuracy check: shows the CURRENT total your dashboard is
actually displaying (confirmed stores only) versus the TRUE total including
every branch still awaiting review, so you can see exactly how far off the
displayed numbers are right now, before applying any merge/confirm
decisions.

Read-only. Does not change anything.
"""
import asyncio
import sys
import os
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func
from app.db.session import AsyncSessionLocal
from app.models.models import Store, McpDailySale
from app.services.mcp_daily_sales import get_daily_sales
from app.services.mcp_branches import MCP_COUNTRIES
from app.services.mcp_sync_service import _normalize_shop_name


async def part1_data_accuracy():
    print("=" * 70)
    print("PART 1: Comparing stored data against a FRESH pull from MCP")
    print("=" * 70)
    today = date.today()
    from_date = today.replace(day=1).isoformat()
    to_date = today.isoformat()
    print(f"Checking current month: {from_date} to {to_date}\n")

    any_mismatch = False
    async with AsyncSessionLocal() as db:
        for country in MCP_COUNTRIES:
            fresh_rows = await get_daily_sales(country["id"], from_date, to_date)
            fresh_by_shop: dict[str, float] = {}
            for r in fresh_rows:
                # Normalize the same way the real sync does before matching,
                # so a shop MCP spells slightly differently across calls
                # (e.g. a missing space around a hyphen) doesn't look like
                # missing data here when it isn't.
                key = _normalize_shop_name(r["store"])
                fresh_by_shop[key] = fresh_by_shop.get(key, 0.0) + r["revenue"]

            stores = (await db.execute(
                select(Store).where(Store.mcp_country_id == country["id"], Store.mcp_shop_name.isnot(None))
            )).scalars().all()

            country_mismatch = False
            for s in stores:
                stored = (await db.execute(
                    select(func.sum(McpDailySale.revenue)).where(
                        McpDailySale.store_id == s.id,
                        McpDailySale.date >= from_date,
                        McpDailySale.date <= to_date,
                    )
                )).scalar() or 0.0
                stored = float(stored)
                fresh = fresh_by_shop.get(_normalize_shop_name(s.mcp_shop_name), 0.0)
                if abs(stored - fresh) > 0.01:
                    country_mismatch = any_mismatch = True
                    print(f"  MISMATCH  {country['name']:10} {s.name!r:45} stored={stored:>14,.2f}  fresh_from_mcp={fresh:>14,.2f}")

            if not country_mismatch:
                print(f"  OK  {country['name']:10} ({len(stores)} branches checked, all match)")

    print()
    if any_mismatch:
        print("Some branches drifted from MCP — re-run rebuild_mcp_daily_sales.py.")
    else:
        print("No mismatches found. Stored data matches MCP exactly for the current month.")


async def part2_dashboard_accuracy():
    print("\n" + "=" * 70)
    print("PART 2: What your dashboard shows now vs. the true total")
    print("=" * 70)
    async with AsyncSessionLocal() as db:
        stores = (await db.execute(select(Store))).scalars().all()
        confirmed_ids = [s.id for s in stores if not s.needs_review]
        review_ids = [s.id for s in stores if s.needs_review]

        confirmed_total = (await db.execute(
            select(func.coalesce(func.sum(McpDailySale.revenue), 0)).where(McpDailySale.store_id.in_(confirmed_ids))
        )).scalar() if confirmed_ids else 0.0
        review_total = (await db.execute(
            select(func.coalesce(func.sum(McpDailySale.revenue), 0)).where(McpDailySale.store_id.in_(review_ids))
        )).scalar() if review_ids else 0.0

        confirmed_total = float(confirmed_total)
        review_total = float(review_total)
        true_total = confirmed_total + review_total

        print(f"\nCurrently shown on your dashboard (confirmed branches only): {confirmed_total:>16,.2f}")
        print(f"Sitting excluded, still needs review:                          {review_total:>16,.2f}")
        print(f"TRUE total (what it should show once fully resolved):         {true_total:>16,.2f}")
        if true_total > 0:
            pct_hidden = review_total / true_total * 100
            print(f"\n-> Your dashboard is currently under-reporting by {pct_hidden:.1f}% of total revenue.")


async def main():
    await part1_data_accuracy()
    await part2_dashboard_accuracy()


if __name__ == "__main__":
    asyncio.run(main())
