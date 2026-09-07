import logging
from datetime import datetime, timezone
from typing import Any, Optional

from .smart_service_client import smart_service
from .mcp_parsers import parse_shop_stock_position, parse_pending_items

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 600  # 10 minutes for stock (changes less frequently)


def _cache_key(*args) -> str:
    return "|".join(str(a) for a in args)


def _get_cached(key: str) -> Optional[Any]:
    if key in _cache:
        ts, data = _cache[key]
        if datetime.now(timezone.utc).timestamp() - ts < _CACHE_TTL:
            return data
        del _cache[key]
    return None


def _set_cached(key: str, data: Any):
    _cache[key] = (datetime.now(timezone.utc).timestamp(), data)


async def get_stock_position(
    country_id: int = None,
    shop_id: int = None,
    low_stock_threshold: int = None,
) -> list[dict[str, Any]]:
    """Get current stock position by shop/model/SKU.

    Returns: [{shop, items: [{count, model, material, position}], total_units}]
    """
    cache_key = _cache_key("stock_position", country_id, shop_id, low_stock_threshold)
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    raw = await smart_service.shop_stock_position(
        shop_id=shop_id,
        country_id=country_id,
        low_stock_threshold=low_stock_threshold,
    )
    result = parse_shop_stock_position(raw)
    _set_cached(cache_key, result)
    return result


async def get_stock_summary(country_id: int = None) -> dict[str, Any]:
    """Get stock summary: total units, per-shop totals, low-stock items."""
    shops = await get_stock_position(country_id=country_id)

    total_units = 0
    stock_by_shop = []
    low_stock_items = []

    for shop in shops:
        shop_total = shop["total_units"]
        total_units += shop_total
        stock_by_shop.append({
            "shop": shop["shop"],
            "total_units": shop_total,
            "item_count": len(shop["items"]),
        })
        for item in shop["items"]:
            if item["count"] >= -5:  # Low stock threshold (negative = available)
                low_stock_items.append({
                    "shop": shop["shop"],
                    "model": item["model"],
                    "material": item["material"],
                    "position": item["position"],
                    "count": item["count"],
                })

    return {
        "total_units": total_units,
        "shop_count": len(shops),
        "stock_by_shop": sorted(stock_by_shop, key=lambda x: x["total_units"]),
        "low_stock_items": low_stock_items,
    }


async def get_pending_items(
    country_id: int = None,
    shop_id: int = None,
    include: str = "both",
) -> list[dict[str, Any]]:
    """Get payment and installation pending items by shop."""
    cache_key = _cache_key("pending_items", country_id, shop_id, include)
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    raw = await smart_service.pending_items_by_shop(
        country_id=country_id, shop_id=shop_id, include=include
    )
    result = parse_pending_items(raw)
    _set_cached(cache_key, result)
    return result
