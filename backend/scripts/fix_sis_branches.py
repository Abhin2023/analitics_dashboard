#!/usr/bin/env python3
"""Merges the 2 Sharaf SIS branches whose correct target was confirmed to
exist in production (MGM SIS, MOO SIS) — the general auto-matcher routed
these wrong before (both to MCC SIS / the wrong "IK" branches) because the
names share "Muscat"/"Oman"/"SIS"/"Mall" words with several other branches.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.models import Store
from app.services.store_merge_service import merge_store_into

VERIFIED_MERGES = [
    ("Sharaf Muscat Grand Mall SIS", "MGM SIS"),
    ("Sharaf DG Oman Mall SIS", "MOO SIS"),
]


async def main():
    async with AsyncSessionLocal() as db:
        by_name = {s.name: s for s in (await db.execute(select(Store))).scalars().all()}

        plan = []
        for source_name, target_name in VERIFIED_MERGES:
            source = by_name.get(source_name)
            target = by_name.get(target_name)
            if not source:
                print(f"NOT FOUND: source {source_name!r}")
            elif not target:
                print(f"NOT FOUND: target {target_name!r}")
            else:
                plan.append((source, target))

        print(f"{len(plan)} merge(s):")
        for source, target in plan:
            print(f"  MERGE  {source.name!r} -> {target.name!r}")

        if not plan:
            print("Nothing to apply.")
            return

        answer = input(f"\nApply {len(plan)} merge(s)? Type 'yes' to proceed: ").strip().lower()
        if answer != "yes":
            print("Aborted — nothing changed.")
            return

        for source, target in plan:
            await merge_store_into(db, source, target)
        await db.commit()
        print(f"\nDone. Merged {len(plan)}.")


if __name__ == "__main__":
    asyncio.run(main())
