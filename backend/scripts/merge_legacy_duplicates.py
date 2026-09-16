#!/usr/bin/env python3
"""Finds and merges pre-existing duplicate CONFIRMED branches — the kind
that predate any MCP work entirely (e.g. "Kerala Kochi" alongside "Kochi",
both confirmed, one sitting at zero revenue forever while the other holds
all the real activity). These were never flagged needs_review because
they were both set up as legitimate branches from day one; the duplication
is a data-entry artifact, not a sync bug.

Groups active stores by a normalized "core" name (stripping common city
prefixes like "Kerala ", "Bangalore ", hyphens, casing, and suffixes like
"Store"/"City"/"Mall"). Within a group, if exactly one store has real
revenue and the rest have none, it proposes merging the zero-revenue ones
into it. Groups that don't fit that clean pattern (multiple stores with
revenue, or no store with revenue) are listed separately as AMBIGUOUS and
never auto-merged — those need an actual human decision, not a guess.

Dry run by default — prints the full plan and asks for one confirmation
before changing anything.
"""
import asyncio
import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func
from app.db.session import AsyncSessionLocal
from app.models.models import Store, McpDailySale
from app.services.store_merge_service import merge_store_into

CITY_PREFIXES = ["Kerala ", "Chennai ", "Bangalore ", "Hyderabad ", "TN ", "Tn ", "Mumbai ", "Delhi "]
STRIP_SUFFIXES = [" store", " city", " mall"]


def core_key(name: str) -> str:
    n = name.strip()
    for p in CITY_PREFIXES:
        if n.startswith(p):
            n = n[len(p):]
            break
    n = re.sub(r"^[\s\-]+", "", n)
    n = re.sub(r"\s*-\s*", " ", n)
    n = re.sub(r"\s+", " ", n).strip().lower()
    for suf in STRIP_SUFFIXES:
        if n.endswith(suf):
            n = n[: -len(suf)].strip()
    return n


async def main():
    async with AsyncSessionLocal() as db:
        stores = (await db.execute(
            select(Store).where(Store.is_active == True, Store.needs_review == False)
        )).scalars().all()

        revenue_by_id = {}
        for s in stores:
            total = (await db.execute(
                select(func.sum(McpDailySale.revenue)).where(McpDailySale.store_id == s.id)
            )).scalar()
            revenue_by_id[s.id] = float(total or 0)

        groups: dict[str, list[Store]] = {}
        for s in stores:
            key = core_key(s.name)
            if not key:
                continue
            groups.setdefault(key, []).append(s)

        clean_merges = []   # (dead_store, live_store)
        ambiguous = []      # (key, [stores])

        for key, group in groups.items():
            if len(group) < 2:
                continue
            with_revenue = [s for s in group if revenue_by_id[s.id] > 0]
            without_revenue = [s for s in group if revenue_by_id[s.id] == 0]
            if len(with_revenue) == 1 and without_revenue:
                live = with_revenue[0]
                for dead in without_revenue:
                    clean_merges.append((dead, live))
            elif len(group) >= 2:
                ambiguous.append((key, group))

        print(f"{len(clean_merges)} clean merge(s) proposed (exactly one branch in the group has revenue):\n")
        for dead, live in clean_merges:
            print(f"  MERGE  id={dead.id:4} {dead.name!r:35} (target={float(dead.monthly_target or 0):>10,.0f}, revenue=0)"
                  f"  ->  id={live.id:4} {live.name!r:30} (revenue={revenue_by_id[live.id]:>12,.2f})")

        if ambiguous:
            print(f"\n{len(ambiguous)} group(s) are AMBIGUOUS — not auto-merged, need your judgment:")
            for key, group in ambiguous:
                print(f"\n  Group {key!r}:")
                for s in group:
                    print(f"    id={s.id:4} {s.name!r:35} target={float(s.monthly_target or 0):>10,.0f}  revenue={revenue_by_id[s.id]:>12,.2f}")

        if not clean_merges:
            print("\nNothing to auto-merge.")
            return

        answer = input(f"\nApply {len(clean_merges)} merge(s)? Type 'yes' to proceed: ").strip().lower()
        if answer != "yes":
            print("Aborted — nothing changed.")
            return

        for dead, live in clean_merges:
            await merge_store_into(db, dead, live)

        await db.commit()
        print(f"\nDone. Merged {len(clean_merges)} legacy duplicate(s).")


if __name__ == "__main__":
    asyncio.run(main())
