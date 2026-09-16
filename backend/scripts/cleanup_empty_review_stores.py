#!/usr/bin/env python3
"""Deletes every store still flagged needs_review that has ZERO rows in
mcp_daily_sales. Safe by construction: a store with no sales rows attached
holds no data to lose, so deleting it can't affect any report.

Run this AFTER rebuild_mcp_daily_sales.py, since that script is what makes
stale duplicate stores end up with zero rows in the first place (their old,
un-normalized mcp_shop_name no longer matches anything from MCP, so the
rebuild simply gives them nothing).

Prints what it's about to delete and asks for confirmation before doing it.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func
from app.db.session import AsyncSessionLocal
from app.models.models import Store, McpDailySale


async def main():
    async with AsyncSessionLocal() as db:
        stores = (await db.execute(select(Store).where(Store.needs_review == True))).scalars().all()
        empty = []
        for s in stores:
            n = (await db.execute(
                select(func.count()).select_from(McpDailySale).where(McpDailySale.store_id == s.id)
            )).scalar()
            if n == 0:
                empty.append(s)

        if not empty:
            print("No empty needs-review stores found. Nothing to do.")
            return

        print(f"{len(empty)} needs-review store(s) with zero sales rows:")
        for s in empty:
            print(f"  - id={s.id}  name={s.name!r}")

        answer = input(f"\nDelete these {len(empty)} store(s)? Type 'yes' to confirm: ").strip().lower()
        if answer != "yes":
            print("Aborted — nothing deleted.")
            return

        for s in empty:
            await db.delete(s)
        await db.commit()
        print(f"Deleted {len(empty)} store(s).")


if __name__ == "__main__":
    asyncio.run(main())
