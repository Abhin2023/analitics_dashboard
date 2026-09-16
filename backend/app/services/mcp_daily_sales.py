import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from .smart_service_client import smart_service
from .mcp_parsers import parse_transaction_detail, parse_shop_target_achievement

logger = logging.getLogger(__name__)

# Simple TTL cache: {key: (timestamp, data)}
_cache: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 300  # 5 minutes


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


_TXN_LIMIT = 500


async def _fetch_transactions(
    country_id: int, from_date: str, to_date: str, limit: int = _TXN_LIMIT
) -> list[dict]:
    """Fetch every transaction in [from_date, to_date] for a country, without
    silently truncating at the API's hard 500-row-per-call cap (confirmed via
    testing: raising `limit` past 500 has no effect — it's a server-side
    limit, not our own default). A single call is used whenever the range
    comes back under the cap; if a call returns exactly `limit` rows, that
    means more transactions exist for that window than were returned, so the
    range is split in half and each half is fetched (and split again if
    needed) until every piece is confirmed complete."""
    raw = await smart_service.transaction_detail(
        from_date=from_date, to_date=to_date, country_id=country_id, limit=limit,
    )
    txns = parse_transaction_detail(raw)
    if len(txns) < limit:
        return txns

    start = datetime.strptime(from_date, "%Y-%m-%d")
    end = datetime.strptime(to_date, "%Y-%m-%d")
    if start >= end:
        # Can't narrow the date window any further — this single day alone
        # has more transactions than the API will ever return in one call.
        logger.warning(
            "Transaction cap hit on a single day %s (country_id=%s) — some "
            "transactions for this day cannot be fetched with the current "
            "API (no further chunking, no shop-level filtering used).",
            from_date, country_id,
        )
        return txns

    mid = start + (end - start) // 2
    left_to = mid.strftime("%Y-%m-%d")
    right_from = (mid + timedelta(days=1)).strftime("%Y-%m-%d")
    left, right = await asyncio.gather(
        _fetch_transactions(country_id, from_date, left_to, limit),
        _fetch_transactions(country_id, right_from, to_date, limit),
    )
    return left + right


async def get_daily_sales(
    country_id: int,
    from_date: str,
    to_date: str,
    max_days: int = 31,
) -> list[dict[str, Any]]:
    """Get daily-aggregated sales by store from MCP transaction data.

    Returns list of: {
        date, store, revenue, units_sold,
        new_sale_count, replacement_count, return_count,
        target, country, currency
    }
    """
    cache_key = _cache_key("daily_sales", country_id, from_date, to_date)
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    start = datetime.strptime(from_date, "%Y-%m-%d")
    transactions = await _fetch_transactions(country_id, from_date, to_date)

    # Get targets (once per country, for the month)
    month_name = start.strftime("%B")
    targets_raw = await smart_service.shop_target_achievement(
        country_id=country_id,
        year=start.year,
        month=month_name,
    )
    targets = {s["shop"]: s["target"] for s in parse_shop_target_achievement(targets_raw)}

    # Aggregate by date + shop
    agg: dict[tuple[str, str], dict] = {}
    for txn in transactions:
        key = (txn["date"], txn["shop"])
        if key not in agg:
            agg[key] = {
                "date": txn["date"],
                "store": txn["shop"],
                "revenue": 0.0,
                "units_sold": 0,
                "new_sale_count": 0,
                "replacement_count": 0,
                "return_count": 0,
                "other_count": 0,
                "target": targets.get(txn["shop"], 0.0),
                "country_id": country_id,
            }
        row = agg[key]
        row["revenue"] += txn["amount"]
        row["units_sold"] += 1
        cat = txn.get("category", "").lower()
        if "new sale" in cat:
            row["new_sale_count"] += 1
        elif "replacement" in cat:
            row["replacement_count"] += 1
        elif "return" in cat:
            row["return_count"] += 1
        else:
            row["other_count"] += 1

    result = sorted(agg.values(), key=lambda x: (x["date"], x["store"]))
    _set_cached(cache_key, result)
    return result


async def get_sales_summary(
    from_date: str,
    to_date: str = None,
    country_id: int = None,
    shop_id: int = None,
) -> dict[str, Any]:
    """Get sales summary (total count, gross, discount, net)."""
    cache_key = _cache_key("sales_summary", from_date, to_date, country_id, shop_id)
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    raw = await smart_service.sales_summary(
        from_date=from_date,
        to_date=to_date,
        country_id=country_id,
        shop_id=shop_id,
    )

    from .mcp_parsers import parse_sales_summary

    result = parse_sales_summary(raw)
    _set_cached(cache_key, result)
    return result


async def get_country_comparison(
    from_date: str,
    to_date: str = None,
) -> list[dict[str, Any]]:
    """Get cross-country sales comparison normalized to USD."""
    cache_key = _cache_key("country_compare", from_date, to_date)
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    raw = await smart_service.compare_country_sales(from_date=from_date, to_date=to_date)
    from .mcp_parsers import parse_compare_country_sales

    result = parse_compare_country_sales(raw)
    _set_cached(cache_key, result)
    return result


async def get_top_models(
    country_id: int,
    from_date: str,
    to_date: str = None,
    top_n: int = 10,
) -> list[dict[str, Any]]:
    """Get top-selling models for a country."""
    cache_key = _cache_key("top_models", country_id, from_date, to_date, top_n)
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    raw = await smart_service.top_models(
        country_id=country_id, from_date=from_date, to_date=to_date, top_n=top_n
    )
    from .mcp_parsers import parse_top_models

    result = parse_top_models(raw)
    _set_cached(cache_key, result)
    return result


async def get_shop_wise_sales(
    country_id: int,
    from_date: str,
    to_date: str = None,
) -> list[dict[str, Any]]:
    """Get shop-wise sales breakdown for a single country."""
    cache_key = _cache_key("shop_wise", country_id, from_date, to_date)
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    raw = await smart_service.shop_wise_sales(
        country_id=country_id, from_date=from_date, to_date=to_date
    )
    from .mcp_parsers import parse_shop_wise_sales

    result = parse_shop_wise_sales(raw)
    _set_cached(cache_key, result)
    return result
