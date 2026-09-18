#!/usr/bin/env python3
"""Checks whether Qatar's real branch(es) are correctly tagged
Store.country == "Qatar" in our DB, or have somehow ended up labeled
"India" (or anything else) — which would explain Qatar appearing under
India anywhere the dashboard groups/filters by that field.

Read-only. Does not change anything.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.models import Store, StoreMcpAlias

# The one real Qatar shop currently in MCP's own target sheet.
KNOWN_QATAR_NAMES = ["Himaya Trading and Services"]


async def main():
    async with AsyncSessionLocal() as db:
        print("Checking known Qatar branch(es) by alias:\n")
        for name in KNOWN_QATAR_NAMES:
            alias = (await db.execute(
                select(StoreMcpAlias).where(StoreMcpAlias.mcp_shop_name == name)
            )).scalar_one_or_none()
            if not alias:
                print(f"  {name!r}: NOT FOUND as an alias in this DB at all.")
                continue
            store = (await db.execute(select(Store).where(Store.id == alias.store_id))).scalar_one()
            flag = "  <-- WRONG, should be Qatar" if store.country != "Qatar" else "  OK"
            print(f"  {name!r} -> Store id={store.id} name={store.name!r} country={store.country!r} mcp_country_id={store.mcp_country_id}{flag}")

        print("\nAll confirmed, active stores currently tagged country='India' (sample of 15):")
        india_stores = (await db.execute(
            select(Store).where(Store.country == "India", Store.needs_review == False, Store.is_active == True).limit(15)
        )).scalars().all()
        for s in india_stores:
            print(f"  id={s.id:5}  {s.name}")

        print("\nAny active store tagged country='Qatar':")
        qatar_stores = (await db.execute(
            select(Store).where(Store.country == "Qatar", Store.is_active == True)
        )).scalars().all()
        if not qatar_stores:
            print("  NONE FOUND — this is likely the bug, if MCP reports a real Qatar branch.")
        for s in qatar_stores:
            print(f"  id={s.id:5}  {s.name}  needs_review={s.needs_review}")


if __name__ == "__main__":
    asyncio.run(main())
