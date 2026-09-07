import asyncio
import logging
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from .smart_service_client import smart_service
from .mcp_parsers import parse_shop_stock_position, parse_shop_target_achievement

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 300  # 5 minutes

MCP_COUNTRIES = [
    {"id": 2, "name": "Oman"},
    {"id": 3, "name": "Pakistan"},
    {"id": 4, "name": "UAE"},
    {"id": 5, "name": "Malaysia"},
    {"id": 6, "name": "UK"},
    {"id": 7, "name": "Bahrain"},
    {"id": 8, "name": "Qatar"},
]


def _now():
    import time
    return time.time()


def _get_cached(key: str) -> Optional[Any]:
    if key in _cache:
        ts, data = _cache[key]
        if _now() - ts < _CACHE_TTL:
            return data
        del _cache[key]
    return None


def _set_cached(key: str, data: Any):
    _cache[key] = (_now(), data)


def _normalize_shop(name: str) -> str:
    return name.strip().lower().replace("  ", " ")


async def _get_india_branches_from_db(db: AsyncSession) -> list[dict[str, Any]]:
    """Fetch India branches from DB (synced from Google Sheets every 1 min)."""
    from ..models.models import Store, DailySubmission, User

    now = datetime.now()
    month_start = date(now.year, now.month, 1)

    store_q = select(Store).where(Store.is_active == True)
    stores = (await db.execute(store_q)).scalars().all()

    branches = []
    for store in stores:
        tl_name = "Unassigned"
        if store.team_leader_id:
            tl_result = await db.execute(select(User.name).where(User.id == store.team_leader_id))
            tl_name = tl_result.scalar() or "Unassigned"

        rev_q = select(
            func.coalesce(func.sum(DailySubmission.revenue), 0),
            func.coalesce(func.sum(DailySubmission.units_sold), 0),
            func.coalesce(func.sum(DailySubmission.walk_ins), 0),
            func.coalesce(func.sum(DailySubmission.walk_in_conversions), 0),
        ).where(
            DailySubmission.store_id == store.id,
            DailySubmission.date >= month_start,
        )
        row = (await db.execute(rev_q)).one()
        revenue = float(row[0] or 0)
        units = int(row[1] or 0)
        walk_ins = int(row[2] or 0)
        conversions = int(row[3] or 0)

        target = float(store.monthly_target or 0)
        achievement_pct = (revenue / target * 100) if target > 0 else 0

        branches.append({
            "shop": store.name,
            "country": "India",
            "country_id": 1,
            "target": target,
            "actual": revenue,
            "achievement_pct": round(achievement_pct, 1),
            "status": "",
            "stock_units": 0,
            "stock_items": [],
            "units_sold": units,
            "walk_ins": walk_ins,
            "conversions": conversions,
            "tl": tl_name,
        })

    return branches


async def get_all_branches(db: AsyncSession) -> list[dict[str, Any]]:
    """Extract all branches from combined sources:
    - India: DB (Store + DailySubmission, synced from Google Sheets)
    - Other countries: MCP (SmartService live API)

    Returns list of: {
        shop, country, country_id, target, actual, achievement_pct,
        stock_units, stock_items
    }
    """
    cache_key = "all_branches"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    # Run India DB query and MCP fetch concurrently
    india_task = _get_india_branches_from_db(db)

    async def fetch_mcp_branches():
        # 1. Get stock position per country (concurrently)
        async def fetch_country_stock(country_id: int) -> list[dict]:
            try:
                raw = await smart_service.shop_stock_position(country_id=country_id)
                return parse_shop_stock_position(raw)
            except Exception as e:
                logger.warning("Failed to fetch stock for country %d: %s", country_id, e)
                return []

        # 2. Get target achievement per non-India country (concurrently)
        async def fetch_country_targets(country_id: int) -> list[dict]:
            try:
                now = datetime.now()
                raw = await smart_service.shop_target_achievement(
                    country_id=country_id,
                    year=now.year,
                    month=now.strftime("%B"),
                )
                return parse_shop_target_achievement(raw)
            except Exception as e:
                logger.warning("Failed to fetch targets for country %d: %s", country_id, e)
                return []

        # Run stock + target fetches per country concurrently
        stock_results, target_results = await asyncio.gather(
            asyncio.gather(*[fetch_country_stock(c["id"]) for c in MCP_COUNTRIES]),
            asyncio.gather(*[fetch_country_targets(c["id"]) for c in MCP_COUNTRIES]),
        )

        # Merge stock data per country
        stock_by_shop: dict[str, dict] = {}
        for country_shops in stock_results:
            for s in country_shops:
                key = _normalize_shop(s["shop"])
                stock_by_shop[key] = {
                    "stock_units": s.get("total_units", 0),
                    "stock_items": s.get("items", []),
                }

        # 3. Build branch list from MCP target data
        branches: dict[str, dict] = {}
        for country_idx, shops in enumerate(target_results):
            country = MCP_COUNTRIES[country_idx]
            for s in shops:
                shop_name = s.get("shop", "")
                if not shop_name:
                    continue
                key = _normalize_shop(shop_name)
                stock = stock_by_shop.get(key, {})
                branches[key] = {
                    "shop": shop_name,
                    "country": country["name"],
                    "country_id": country["id"],
                    "target": s.get("target", 0),
                    "actual": s.get("actual", 0),
                    "achievement_pct": s.get("achievement_pct", 0),
                    "status": s.get("status", ""),
                    "stock_units": stock.get("stock_units", 0),
                    "stock_items": stock.get("stock_items", []),
                }

        # 4. Add stock-only shops not found in target data
        for key, stock in stock_by_shop.items():
            if key not in branches:
                branches[key] = {
                    "shop": stock.get("shop", key),
                    "country": "Unknown",
                    "country_id": 0,
                    "target": 0,
                    "actual": 0,
                    "achievement_pct": 0,
                    "status": "",
                    "stock_units": stock.get("stock_units", 0),
                    "stock_items": stock.get("stock_items", []),
                }

        return list(branches.values())

    mcp_task = fetch_mcp_branches()

    india_branches, mcp_branches = await asyncio.gather(india_task, mcp_task)

    # Merge: India from DB + others from MCP
    all_branches = india_branches + mcp_branches
    result = sorted(all_branches, key=lambda x: (x["country"], x["shop"]))
    _set_cached(cache_key, result)
    return result
