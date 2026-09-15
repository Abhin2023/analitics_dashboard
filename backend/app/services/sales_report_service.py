from datetime import date, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.models import Store, User, McpDailySale, DailySubmission
from .mcp_sync_service import sync_mcp_sales


def _default_range(granularity: str) -> tuple[date, date]:
    today = date.today()
    if granularity == "day":
        return today, today
    if granularity == "week":
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=6)
    # month
    start = today.replace(day=1)
    if start.month == 12:
        next_month = date(start.year + 1, 1, 1)
    else:
        next_month = date(start.year, start.month + 1, 1)
    return start, next_month - timedelta(days=1)


def _bucket_key(d: date, granularity: str) -> str:
    if granularity == "day":
        return d.isoformat()
    if granularity == "week":
        monday = d - timedelta(days=d.weekday())
        return monday.isoformat()
    return d.strftime("%Y-%m")


async def _ensure_mcp_coverage(db: AsyncSession, start_date: date, end_date: date) -> None:
    """Lazily backfill mcp_daily_sales for the requested range if it isn't
    fully synced yet, so filtering by an arbitrary date range doesn't just
    return an empty/partial result."""
    result = await db.execute(
        select(McpDailySale.date).where(
            McpDailySale.date >= start_date, McpDailySale.date <= end_date
        ).distinct()
    )
    synced_dates = {row[0] for row in result.all()}
    expected_days = (end_date - start_date).days + 1
    if len(synced_dates) < expected_days:
        await sync_mcp_sales(db, start_date.isoformat(), end_date.isoformat())


async def get_sales_report(
    db: AsyncSession,
    granularity: str = "month",
    start: Optional[str] = None,
    end: Optional[str] = None,
    team_leader_id: Optional[int] = None,
    store_id: Optional[int] = None,
    country: Optional[str] = None,
    region: Optional[str] = None,
    group_by: str = "none",
) -> dict:
    if granularity not in ("day", "week", "month"):
        granularity = "month"
    if start and end:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    else:
        start_date, end_date = _default_range(granularity)

    await _ensure_mcp_coverage(db, start_date, end_date)

    store_q = select(Store, User.name.label("tl_name")).outerjoin(
        User, Store.team_leader_id == User.id
    ).where(Store.is_active == True)
    if team_leader_id is not None:
        store_q = store_q.where(Store.team_leader_id == team_leader_id)
    if store_id is not None:
        store_q = store_q.where(Store.id == store_id)
    if country:
        store_q = store_q.where(Store.country == country)
    if region:
        store_q = store_q.where(Store.region == region)

    store_rows = (await db.execute(store_q)).all()
    stores_by_id = {s.id: (s, tl_name) for s, tl_name in store_rows}
    store_ids = list(stores_by_id.keys())
    if not store_ids:
        return {
            "start": start_date.isoformat(), "end": end_date.isoformat(), "granularity": granularity,
            "total_revenue": 0, "total_target": 0, "achievement_pct": 0,
            "total_walkins": 0, "total_conversions": 0,
            "trend": [], "breakdown": [], "needs_review": [], "top_branch": None,
        }

    india_store_ids = [sid for sid, (s, _) in stores_by_id.items() if s.country == "India"]

    sales_rows = (await db.execute(
        select(McpDailySale).where(
            McpDailySale.store_id.in_(store_ids),
            McpDailySale.date >= start_date,
            McpDailySale.date <= end_date,
        )
    )).scalars().all()

    funnel_rows = []
    if india_store_ids:
        funnel_rows = (await db.execute(
            select(DailySubmission).where(
                DailySubmission.store_id.in_(india_store_ids),
                DailySubmission.date >= start_date,
                DailySubmission.date <= end_date,
            )
        )).scalars().all()

    # Per-store aggregates: revenue sums across days, target is a monthly
    # snapshot repeated per day so it's taken once (latest date), not summed.
    per_store: dict[int, dict] = {}
    for sid in store_ids:
        per_store[sid] = {"revenue": 0.0, "target": 0.0, "target_date": None, "walkins": 0, "conversions": 0}

    trend_map: dict[str, dict] = {}
    for row in sales_rows:
        agg = per_store[row.store_id]
        agg["revenue"] += float(row.revenue or 0)
        if agg["target_date"] is None or row.date > agg["target_date"]:
            agg["target"] = float(row.target or 0)
            agg["target_date"] = row.date

        key = _bucket_key(row.date, granularity)
        bucket = trend_map.setdefault(key, {"period": key, "revenue": 0.0})
        bucket["revenue"] += float(row.revenue or 0)

    for row in funnel_rows:
        agg = per_store[row.store_id]
        agg["walkins"] += row.walk_ins or 0
        agg["conversions"] += row.walk_in_conversions or 0

    confirmed_ids = [sid for sid, (s, _) in stores_by_id.items() if not s.needs_review]
    review_ids = [sid for sid, (s, _) in stores_by_id.items() if s.needs_review]

    total_revenue = sum(per_store[sid]["revenue"] for sid in confirmed_ids)
    total_target = sum(per_store[sid]["target"] for sid in confirmed_ids)
    total_walkins = sum(per_store[sid]["walkins"] for sid in confirmed_ids)
    total_conversions = sum(per_store[sid]["conversions"] for sid in confirmed_ids)

    def _group_key(sid: int) -> str:
        store, tl_name = stores_by_id[sid]
        if group_by == "team_leader":
            return tl_name or "Unassigned"
        if group_by == "branch":
            return store.name
        if group_by == "region":
            return store.region or store.country or "Unknown"
        return "All"

    group_map: dict[str, dict] = {}
    for sid in confirmed_ids:
        key = _group_key(sid)
        store, _ = stores_by_id[sid]
        # Each branch/region group is within one country, so its own currency
        # can be shown correctly instead of defaulting to INR everywhere.
        g = group_map.setdefault(key, {
            "key": key, "country": store.country, "revenue": 0.0, "target": 0.0,
            "walkins": 0, "conversions": 0, "store_count": 0,
        })
        g["revenue"] += per_store[sid]["revenue"]
        g["target"] += per_store[sid]["target"]
        g["walkins"] += per_store[sid]["walkins"]
        g["conversions"] += per_store[sid]["conversions"]
        g["store_count"] += 1

    breakdown = []
    for g in group_map.values():
        g["achievement_pct"] = round(g["revenue"] / g["target"] * 100, 1) if g["target"] > 0 else 0
        breakdown.append(g)
    breakdown.sort(key=lambda x: x["revenue"], reverse=True)

    # Top branch by revenue for this exact period — computed by branch name
    # regardless of the requested group_by, so "who's #1 right now" is always
    # available even when viewing the team-leader/region/all-together rollup.
    branch_totals: dict[str, dict] = {}
    for sid in confirmed_ids:
        store, _ = stores_by_id[sid]
        b = branch_totals.setdefault(store.name, {"name": store.name, "country": store.country, "revenue": 0.0, "target": 0.0})
        b["revenue"] += per_store[sid]["revenue"]
        b["target"] += per_store[sid]["target"]
    top_branch = None
    if branch_totals:
        top_branch = max(branch_totals.values(), key=lambda x: x["revenue"])
        top_branch["achievement_pct"] = (
            round(top_branch["revenue"] / top_branch["target"] * 100, 1) if top_branch["target"] > 0 else 0
        )

    needs_review = []
    for sid in review_ids:
        store, _ = stores_by_id[sid]
        needs_review.append({
            "store_id": sid, "store": store.name, "country": store.country,
            "revenue": per_store[sid]["revenue"],
        })

    trend = sorted(trend_map.values(), key=lambda x: x["period"])

    return {
        "start": start_date.isoformat(), "end": end_date.isoformat(), "granularity": granularity,
        "total_revenue": total_revenue, "total_target": total_target,
        "achievement_pct": round(total_revenue / total_target * 100, 1) if total_target > 0 else 0,
        "total_walkins": total_walkins, "total_conversions": total_conversions,
        "trend": trend, "breakdown": breakdown, "needs_review": needs_review,
        "top_branch": top_branch,
    }
