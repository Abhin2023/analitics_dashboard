#!/usr/bin/env python3
"""Prints every confirmed India store's current target — read from
Store.monthly_target, the field the dashboard actually uses — so it can be
compared line-by-line against MCP's own target sheet, to pinpoint exactly
which branch is missing or has an incorrect target.

Read-only. Does not change anything.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.models import Store, StoreMcpAlias


async def main():
    async with AsyncSessionLocal() as db:
        stores = (await db.execute(
            select(Store).where(Store.country == "India", Store.needs_review == False, Store.is_active == True)
        )).scalars().all()

        rows = []
        total = 0.0
        excluded_no_alias = 0.0
        for s in stores:
            aliases = (await db.execute(
                select(StoreMcpAlias.mcp_shop_name).where(StoreMcpAlias.store_id == s.id)
            )).scalars().all()
            raw_target = float(s.monthly_target or 0)
            # Match sales_report_service.py exactly: a store with no MCP
            # alias at all is never counted, even if its monthly_target
            # field holds an old manually-entered number (usually a stale
            # leftover on a legacy duplicate that a real branch replaced).
            target = raw_target if aliases else 0.0
            if not aliases and raw_target:
                excluded_no_alias += raw_target
            total += target
            rows.append((s.name, target, raw_target, list(aliases)))

        rows.sort(key=lambda r: -r[2])
        print(f"{'Branch':40} {'Counted':>12}  {'Raw field':>12}  Known MCP name(s)")
        print("-" * 110)
        for name, target, raw_target, aliases in rows:
            alias_str = ", ".join(aliases) if aliases else "(none — EXCLUDED)"
            flag = "  <- has a stale value but no MCP alias, correctly excluded" if not aliases and raw_target else ""
            print(f"{name:40} {target:>12,.0f}  {raw_target:>12,.0f}  {alias_str}{flag}")

        print(f"\nTotal India target (dashboard total, matches sales_report_service.py): {total:,.2f}")
        if excluded_no_alias:
            print(f"(₹{excluded_no_alias:,.2f} sitting on branches with no MCP alias was correctly excluded from that total)")


if __name__ == "__main__":
    asyncio.run(main())
