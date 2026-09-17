#!/usr/bin/env python3
"""Cross-checks Total Target across EVERY country: fetches the current
month's target sheet fresh from MCP right now, and compares it against what
Store.monthly_target currently holds for each confirmed, aliased branch (the
exact same field/filtering sales_report_service.py uses for the dashboard
total). Flags any branch whose stored target doesn't match what MCP is
reporting for it right now, so a stale value (left over from before a sync
last refreshed it) can be pinpointed instead of just seeing a mismatched
grand total.

Read-only. Does not change anything.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.models import Store, StoreMcpAlias
from app.services.mcp_daily_sales import get_current_month_targets
from app.services.mcp_branches import MCP_COUNTRIES
from app.services.mcp_sync_service import _normalize_shop_name


async def main():
    async with AsyncSessionLocal() as db:
        grand_local_total = 0.0
        grand_mcp_total = 0.0

        for country in MCP_COUNTRIES:
            raw_targets = await get_current_month_targets(country["id"])
            fresh_by_norm: dict[str, float] = {}
            for name, val in raw_targets.items():
                fresh_by_norm[_normalize_shop_name(name)] = fresh_by_norm.get(_normalize_shop_name(name), 0.0) + float(val)
            mcp_total = sum(raw_targets.values())
            grand_mcp_total += mcp_total

            stores = (await db.execute(
                select(Store).where(Store.country == country["name"], Store.needs_review == False, Store.is_active == True)
            )).scalars().all()

            country_local_total = 0.0
            mismatches = []
            for s in stores:
                aliases = (await db.execute(
                    select(StoreMcpAlias.mcp_shop_name).where(StoreMcpAlias.store_id == s.id)
                )).scalars().all()
                if not aliases:
                    continue
                local_target = float(s.monthly_target or 0)
                country_local_total += local_target

                mcp_val_for_store = max((fresh_by_norm.get(_normalize_shop_name(a), 0.0) for a in aliases), default=0.0)
                if abs(mcp_val_for_store - local_target) > 1:
                    mismatches.append((s, local_target, mcp_val_for_store, list(aliases)))

            grand_local_total += country_local_total
            print(f"{country['name']:10}  stored_in_db={country_local_total:>14,.2f}   fresh_from_mcp={mcp_total:>14,.2f}")
            for s, local, mcp_now, aliases in mismatches:
                print(f"    MISMATCH  {s.name!r:45} db_stored={local:>12,.0f}  mcp_now={mcp_now:>12,.0f}  aliases={aliases}")

        print(f"\nGRAND TOTAL  stored_in_db={grand_local_total:,.2f}   fresh_from_mcp={grand_mcp_total:,.2f}")
        print("\nAny 'MISMATCH' row above is a branch whose stored target has NOT been refreshed to match "
              "what MCP shows right now for its known name(s). Re-running your normal MCP sync should fix these.")


if __name__ == "__main__":
    asyncio.run(main())
