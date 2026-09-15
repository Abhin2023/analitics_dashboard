#!/usr/bin/env python3
"""One-off cleanup for stores that ended up duplicated under the same
mcp_shop_name — caused by two backend processes racing to auto-create the
same new MCP shop at the same time (see the MultipleResultsFound crash this
was written to fix). For each mcp_shop_name with more than one Store row,
keeps the oldest (lowest id) and re-points every other one's mcp_daily_sales
rows onto it before deleting the duplicate — same merge logic already used
by POST /stores/{id}/merge-into/{target_id}. Safe to re-run.
"""
import asyncio
import sys
import os
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, update
from app.db.session import AsyncSessionLocal
from app.models.models import Store, McpDailySale


async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Store).where(Store.mcp_shop_name.isnot(None)).order_by(Store.id)
        )
        stores = result.scalars().all()

        groups: dict[str, list[Store]] = defaultdict(list)
        for s in stores:
            groups[s.mcp_shop_name].append(s)

        dup_groups = {name: rows for name, rows in groups.items() if len(rows) > 1}
        if not dup_groups:
            print("No duplicate mcp_shop_name stores found.")
            return

        merged = 0
        for name, rows in dup_groups.items():
            keep = rows[0]
            print(f"'{name}': keeping store {keep.id}, merging {[r.id for r in rows[1:]]} into it")
            for dup in rows[1:]:
                existing_dates_result = await db.execute(
                    select(McpDailySale.date).where(McpDailySale.store_id == keep.id)
                )
                existing_dates = {row[0] for row in existing_dates_result.all()}
                collide_result = await db.execute(
                    select(McpDailySale).where(
                        McpDailySale.store_id == dup.id, McpDailySale.date.in_(existing_dates)
                    )
                )
                for row in collide_result.scalars().all():
                    await db.delete(row)
                await db.flush()

                await db.execute(
                    update(McpDailySale).where(McpDailySale.store_id == dup.id).values(store_id=keep.id)
                )
                await db.delete(dup)
                merged += 1

        await db.commit()
        print(f"\nDone. Merged {merged} duplicate store(s) across {len(dup_groups)} shop name(s).")


if __name__ == "__main__":
    asyncio.run(main())
