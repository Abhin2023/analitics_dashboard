from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ...core.deps import get_db, require_permission
from ...models.models import Store, User, DailySubmission, Lead, Campaign, Task, Investment
from ...schemas import DashboardResponse, KPICard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


async def _user_store_ids(user, db):
    if user.store_access:
        return [sa.store_id for sa in user.store_access]
    result = await db.execute(select(Store.id))
    return [r[0] for r in result.all()]


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    start: date = None, end: date = None,
    db: AsyncSession = Depends(get_db),
    user: User = require_permission("dashboard", "view"),
):
    if not end:
        end = date.today()
    if not start:
        start = end - timedelta(days=30)
    store_ids = await _user_store_ids(user, db)

    rev_q = select(func.coalesce(func.sum(DailySubmission.revenue), 0)).where(
        DailySubmission.date >= start, DailySubmission.date <= end
    )
    if store_ids:
        rev_q = rev_q.where(DailySubmission.store_id.in_(store_ids))
    total_revenue = float((await db.execute(rev_q)).scalar() or 0)

    prev_start = start - (end - start)
    prev_end = start - timedelta(days=1)
    prev_rev_q = select(func.coalesce(func.sum(DailySubmission.revenue), 0)).where(
        DailySubmission.date >= prev_start, DailySubmission.date <= prev_end
    )
    if store_ids:
        prev_rev_q = prev_rev_q.where(DailySubmission.store_id.in_(store_ids))
    prev_revenue = float((await db.execute(prev_rev_q)).scalar() or 0)

    store_q = select(Store).where(Store.is_active == True)
    if store_ids:
        store_q = store_q.where(Store.id.in_(store_ids))
    stores = (await db.execute(store_q)).scalars().all()
    days_in_period = (end - start).days + 1
    total_target = sum(float(s.monthly_target) * days_in_period / 30 for s in stores)

    achievement_pct = (total_revenue / total_target * 100) if total_target > 0 else 0

    inv_q = select(func.coalesce(func.sum(Investment.amount), 0)).where(
        Investment.date >= start, Investment.date <= end
    )
    if store_ids:
        inv_q = inv_q.where(Investment.store_id.in_(store_ids))
    total_investment = float((await db.execute(inv_q)).scalar() or 0)

    tl_ids = list(set(s.team_leader_id for s in stores))
    active_tls = len(tl_ids)

    lead_q = select(func.count(Lead.id)).where(Lead.status.in_(["hot", "warm"]))
    if store_ids:
        lead_q = lead_q.where(Lead.store_id.in_(store_ids))
    active_leads = int((await db.execute(lead_q)).scalar() or 0)

    trend = []
    current = start
    while current <= end:
        day_q = select(func.coalesce(func.sum(DailySubmission.revenue), 0)).where(
            DailySubmission.date == current
        )
        if store_ids:
            day_q = day_q.where(DailySubmission.store_id.in_(store_ids))
        day_rev = float((await db.execute(day_q)).scalar() or 0)
        trend.append({"date": current.isoformat(), "revenue": day_rev})
        current += timedelta(days=1)

    breakdown = []
    for tl_id in tl_ids:
        tl_stores = [s.id for s in stores if s.team_leader_id == tl_id]
        tl_rev_q = select(func.coalesce(func.sum(DailySubmission.revenue), 0)).where(
            DailySubmission.date >= start, DailySubmission.date <= end,
            DailySubmission.store_id.in_(tl_stores),
        )
        tl_rev = float((await db.execute(tl_rev_q)).scalar() or 0)
        r = await db.execute(select(User.name).where(User.id == tl_id))
        tl_name = r.scalar() or "Unknown"
        breakdown.append({"name": tl_name, "value": tl_rev})

    top_tls = []
    for tl_id in tl_ids:
        tl_stores = [s.id for s in stores if s.team_leader_id == tl_id]
        tl_rev_q = select(func.coalesce(func.sum(DailySubmission.revenue), 0)).where(
            DailySubmission.date >= start, DailySubmission.date <= end,
            DailySubmission.store_id.in_(tl_stores),
        )
        tl_rev = float((await db.execute(tl_rev_q)).scalar() or 0)
        tl_target = sum(float(s.monthly_target) * days_in_period / 30 for s in stores if s.team_leader_id == tl_id)
        r = await db.execute(select(User.name).where(User.id == tl_id))
        tl_name = r.scalar() or "Unknown"
        ach = (tl_rev / tl_target * 100) if tl_target > 0 else 0
        lead_count_q = select(func.count(Lead.id)).where(
            Lead.store_id.in_(tl_stores), Lead.status.in_(["hot", "warm"])
        )
        leads = int((await db.execute(lead_count_q)).scalar() or 0)
        top_tls.append({
            "name": tl_name, "revenue": tl_rev, "target": tl_target,
            "achievement": ach, "active_leads": leads,
        })
    top_tls.sort(key=lambda x: x["revenue"], reverse=True)

    lead_statuses = ["hot", "warm", "cold", "inactive"]
    lead_dist = []
    for ls in lead_statuses:
        q = select(func.count(Lead.id)).where(Lead.status == ls)
        if store_ids:
            q = q.where(Lead.store_id.in_(store_ids))
        count = int((await db.execute(q)).scalar() or 0)
        lead_dist.append({"name": ls.capitalize(), "value": count})

    campaign_count = int((await db.execute(select(func.count(Campaign.id)))).scalar() or 0)
    task_count = int((await db.execute(select(func.count(Task.id)))).scalar() or 0)
    pending_tasks = int((await db.execute(
        select(func.count(Task.id)).where(Task.status == "pending")
    )).scalar() or 0)

    revenue_delta = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0

    return DashboardResponse(
        total_revenue=KPICard(value=total_revenue, delta=revenue_delta, trend=[t["revenue"] for t in trend[-7:]]),
        total_target=KPICard(value=total_target),
        achievement_pct=KPICard(value=achievement_pct),
        total_investment=KPICard(value=total_investment),
        active_team_leaders=KPICard(value=active_tls),
        active_leads=KPICard(value=active_leads),
        revenue_trend=trend,
        revenue_breakdown=breakdown,
        achievement_gauge=achievement_pct,
        top_team_leaders=top_tls,
        lead_status_distribution=lead_dist,
        bottom_strip={
            "total_campaigns": campaign_count,
            "total_tasks": task_count,
            "pending_tasks": pending_tasks,
        },
    )
