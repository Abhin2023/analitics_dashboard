#!/usr/bin/env python3
"""Permanently deletes specific branches confirmed as unwanted (test data,
junk placeholders — not real branches to merge or keep). Unlike merging,
there's no target to move their data onto, so this deletes their own
sales rows and any recorded name-aliases before deleting the branch itself.

Dry run by default — prints what it found and asks for confirmation before
deleting anything.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func, delete as sa_delete
from app.db.session import AsyncSessionLocal
from app.models.models import Store, McpDailySale, StoreMcpAlias

# Names confirmed as unwanted — edit this list for future one-off cleanups.
UNWANTED_NAMES = ["KANLEE INNOVATIONS HO", "Test shop BP", "Test shop Dubai"]


async def main():
    async with AsyncSessionLocal() as db:
        stores = (await db.execute(select(Store).where(Store.name.in_(UNWANTED_NAMES)))).scalars().all()
        if not stores:
            print("None of the listed names were found — nothing to do.")
            return

        print("About to permanently delete:")
        for s in stores:
            revenue = (await db.execute(
                select(func.sum(McpDailySale.revenue)).where(McpDailySale.store_id == s.id)
            )).scalar()
            n_aliases = (await db.execute(
                select(func.count()).select_from(StoreMcpAlias).where(StoreMcpAlias.store_id == s.id)
            )).scalar()
            print(f"  id={s.id} {s.name!r}  country={s.country}  revenue={float(revenue or 0):,.2f}  ({n_aliases} recorded name(s))")

        answer = input(f"\nPermanently delete these {len(stores)} branch(es) and their sales records? Type 'yes' to proceed: ").strip().lower()
        if answer != "yes":
            print("Aborted — nothing changed.")
            return

        for s in stores:
            await db.execute(sa_delete(McpDailySale).where(McpDailySale.store_id == s.id))
            await db.execute(sa_delete(StoreMcpAlias).where(StoreMcpAlias.store_id == s.id))
            await db.delete(s)

        await db.commit()
        print(f"\nDone. Deleted {len(stores)} branch(es).")


if __name__ == "__main__":
    asyncio.run(main())
