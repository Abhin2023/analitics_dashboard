#!/usr/bin/env python3
"""One-time rebuild of mcp_daily_sales: deletes every row currently stored,
then re-syncs the exact same date range fresh from MCP using the corrected
fetch logic (see mcp_daily_sales.py's _fetch_transactions, which no longer
silently truncates at the API's 500-row-per-call cap).

Run this ONCE, after deploying the mcp_sync_service.py and mcp_daily_sales.py
fixes and restarting the app, to replace whatever undercounted/duplicated
data is already stored with accurate numbers. Safe to re-run, but pointless
to run twice in a row (the second run would just re-fetch the same range).

mcp_daily_sales is a synced mirror of MCP's own transaction records, not a
primary data source, so clearing and re-fetching it is fully recoverable —
nothing is lost, it can always be pulled again from MCP.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func, delete
from app.db.session import AsyncSessionLocal
from app.models.models import McpDailySale, Store
from app.services.mcp_sync_service import sync_mcp_sales


async def main():
    async with AsyncSessionLocal() as db:
        row = (await db.execute(
            select(func.min(McpDailySale.date), func.max(McpDailySale.date), func.count())
            .select_from(McpDailySale)
        )).first()
        from_date, to_date, count = row
        if count == 0:
            print("mcp_daily_sales is already empty — nothing to rebuild.")
            return
        print(f"Detected existing range: {from_date} to {to_date} ({count} rows)")

        print("Deleting all existing mcp_daily_sales rows...")
        result = await db.execute(delete(McpDailySale))
        await db.commit()
        print(f"Deleted {result.rowcount} rows.")

    async with AsyncSessionLocal() as db:
        print(f"\nRe-syncing fresh data for {from_date} to {to_date} across all countries...")
        result = await sync_mcp_sales(db, str(from_date), str(to_date))
        print(result)

    async with AsyncSessionLocal() as db:
        new_count = (await db.execute(select(func.count()).select_from(McpDailySale))).scalar()
        new_range = (await db.execute(
            select(func.min(McpDailySale.date), func.max(McpDailySale.date)).select_from(McpDailySale)
        )).first()
        print(f"\nAfter rebuild: {new_count} rows, range {new_range[0]} to {new_range[1]}")

        # Any branch still flagged needs_review with zero sales rows after
        # this clean rebuild is a stale duplicate that never received real
        # data under its current name — safe to delete outright, no data to
        # lose. This does NOT delete anything itself; it only reports.
        stores = (await db.execute(select(Store).where(Store.needs_review == True))).scalars().all()
        empty = []
        for s in stores:
            n = (await db.execute(
                select(func.count()).select_from(McpDailySale).where(McpDailySale.store_id == s.id)
            )).scalar()
            if n == 0:
                empty.append(s)

        if empty:
            print(f"\n{len(empty)} needs-review branch(es) now have ZERO sales rows after the rebuild — "
                  f"these are stale duplicates safe to delete (nothing merges into them):")
            for s in empty:
                print(f"  - id={s.id}  name={s.name!r}  mcp_shop_name={s.mcp_shop_name!r}")
            print("\nThese were NOT deleted automatically. Remove them via the Branch Assignment "
                  "page, or DELETE FROM stores WHERE id IN (...) if you're confident, after review.")
        else:
            print("\nNo empty needs-review branches found.")


if __name__ == "__main__":
    asyncio.run(main())
