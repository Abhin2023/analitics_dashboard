from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from ...core.deps import get_db, require_permission
from ...models.models import Store, User, DailySubmission, Lead, Campaign, Task, Investment, TeleCallLead, TeleSheetAssignment
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


@router.get("/team-leader")
async def get_team_leader_dashboard(
    start: date = None, end: date = None,
    db: AsyncSession = Depends(get_db),
    user: User = require_permission("dashboard", "view"),
):
    if not end:
        end = date.today()
    if not start:
        start = end - timedelta(days=30)
    days_in_period = (end - start).days + 1
    today = date.today()

    stores = (await db.execute(
        select(Store).where(Store.team_leader_id == user.id, Store.is_active == True)
    )).scalars().all()
    store_ids = [s.id for s in stores]

    assigned_sheets = (await db.execute(
        select(TeleSheetAssignment.sheet_tl_name).where(TeleSheetAssignment.user_id == user.id)
    )).scalars().all()

    total_revenue = 0
    total_target = 0
    store_data = []
    for s in stores:
        rev = float((await db.execute(
            select(func.coalesce(func.sum(DailySubmission.revenue), 0)).where(
                DailySubmission.store_id == s.id,
                DailySubmission.date >= start, DailySubmission.date <= end,
            )
        )).scalar() or 0)
        tgt = float(s.monthly_target) * days_in_period / 30
        ach = (rev / tgt * 100) if tgt > 0 else 0

        wi = int((await db.execute(
            select(func.coalesce(func.sum(DailySubmission.walk_ins), 0)).where(
                DailySubmission.store_id == s.id,
                DailySubmission.date >= start, DailySubmission.date <= end,
            )
        )).scalar() or 0)
        wic = int((await db.execute(
            select(func.coalesce(func.sum(DailySubmission.walk_in_conversions), 0)).where(
                DailySubmission.store_id == s.id,
                DailySubmission.date >= start, DailySubmission.date <= end,
            )
        )).scalar() or 0)

        submitted = (await db.execute(
            select(func.count(DailySubmission.id)).where(
                DailySubmission.store_id == s.id, DailySubmission.date == today,
            )
        )).scalar() or 0

        total_revenue += rev
        total_target += tgt
        store_data.append({
            "id": s.id, "name": s.name, "revenue": rev, "target": tgt,
            "achievement_pct": round(ach, 1),
            "walk_ins": wi, "walk_in_conversions": wic,
            "conversion_pct": round((wic / wi * 100) if wi > 0 else 0, 1),
            "submitted_today": submitted > 0,
        })

    overall_ach = (total_revenue / total_target * 100) if total_target > 0 else 0
    submitted_count = sum(1 for s in store_data if s["submitted_today"])
    submission_pct = (submitted_count / len(store_data) * 100) if store_data else 0
    total_wi = sum(s["walk_ins"] for s in store_data)
    total_wic = sum(s["walk_in_conversions"] for s in store_data)
    wi_conv = (total_wic / total_wi * 100) if total_wi > 0 else 0

    lead_q = select(TeleCallLead).where(TeleCallLead.sheet_tl_name.in_(assigned_sheets)) if assigned_sheets else select(TeleCallLead).where(False)
    all_leads = (await db.execute(lead_q)).scalars().all()

    funnel = {}
    for l in all_leads:
        st = l.status or "Unknown"
        funnel[st] = funnel.get(st, 0) + 1

    tele_stats = {}
    for l in all_leads:
        pc = l.person_calling or "Unassigned"
        if pc not in tele_stats:
            tele_stats[pc] = {"name": pc, "total_leads": 0, "converted": 0, "appointments": 0,
                              "calls_connected": 0, "calls_not_connected": 0}
        tele_stats[pc]["total_leads"] += 1
        if l.status == "Sale Conversion":
            tele_stats[pc]["converted"] += 1
        elif l.status == "Appointment":
            tele_stats[pc]["appointments"] += 1
        if l.status not in ("Wrong number", "Unattended"):
            tele_stats[pc]["calls_connected"] += 1
        else:
            tele_stats[pc]["calls_not_connected"] += 1

    telecaller_perf = sorted(tele_stats.values(), key=lambda x: x["converted"], reverse=True)
    for t in telecaller_perf:
        t["conversion_pct"] = round((t["converted"] / t["total_leads"] * 100) if t["total_leads"] > 0 else 0, 1)

    trend = []
    current = start
    while current <= end:
        day_rev = float((await db.execute(
            select(func.coalesce(func.sum(DailySubmission.revenue), 0)).where(
                DailySubmission.date == current,
                DailySubmission.store_id.in_(store_ids) if store_ids else True,
            )
        )).scalar() or 0)
        trend.append({"date": current.isoformat(), "revenue": day_rev})
        current += timedelta(days=1)

    return {
        "stores": store_data,
        "kpi": {
            "total_revenue": total_revenue,
            "total_target": total_target,
            "achievement_pct": round(overall_ach, 1),
            "total_walk_ins": total_wi,
            "total_walk_in_conversions": total_wic,
            "walk_in_conversion_pct": round(wi_conv, 1),
            "active_leads": len([l for l in all_leads if l.status in ("Call back later", "Will Visit", "Appointment")]),
            "submission_compliance_pct": round(submission_pct, 1),
        },
        "lead_funnel": funnel,
        "telecaller_performance": telecaller_perf,
        "revenue_trend": trend,
    }


@router.get("/telecaller")
async def get_telecaller_dashboard(
    start: date = None, end: date = None,
    db: AsyncSession = Depends(get_db),
    user: User = require_permission("dashboard", "view"),
):
    if not end:
        end = date.today()
    if not start:
        start = end - timedelta(days=30)

    assigned_sheets = (await db.execute(
        select(TeleSheetAssignment.sheet_tl_name).where(TeleSheetAssignment.user_id == user.id)
    )).scalars().all()

    leads = (await db.execute(
        select(TeleCallLead).where(
            TeleCallLead.person_calling == user.name,
            TeleCallLead.sheet_tl_name.in_(assigned_sheets) if assigned_sheets else True,
        ).order_by(TeleCallLead.created_at.desc())
    )).scalars().all()

    total = len(leads)
    converted = len([l for l in leads if l.status == "Sale Conversion"])
    appointments = len([l for l in leads if l.status == "Appointment"])
    will_visit = len([l for l in leads if l.status == "Will Visit"])
    call_back = len([l for l in leads if l.status == "Call back later"])
    not_connected = len([l for l in leads if l.status == "Call Not Connected"])
    not_interested = len([l for l in leads if l.status == "Not Interested"])
    wrong_number = len([l for l in leads if l.status == "Wrong number"])
    unattended = len([l for l in leads if l.status == "Unattended"])
    conv_pct = (converted / total * 100) if total > 0 else 0

    total_sale = 0
    for l in leads:
        if l.sale_amount:
            try:
                total_sale += float(l.sale_amount.replace(",", "").replace("₹", "").replace("$", "").strip() or 0)
            except (ValueError, AttributeError):
                pass

    status_breakdown = []
    status_counts = {}
    for l in leads:
        st = l.status or "Unknown"
        status_counts[st] = status_counts.get(st, 0) + 1
    for st, cnt in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
        status_breakdown.append({"status": st, "count": cnt})

    recent = []
    for l in leads[:20]:
        recent.append({
            "id": l.id, "full_name": l.full_name, "phone": l.phone,
            "status": l.status, "lead_source": l.lead_source,
            "call_date": l.call_date, "remarks": l.remarks,
            "sheet_tl_name": l.sheet_tl_name,
        })

    daily_calls = {}
    for l in leads:
        cd = l.call_date or ""
        if cd:
            if cd not in daily_calls:
                daily_calls[cd] = {"date": cd, "connected": 0, "not_connected": 0}
            if l.status not in ("Wrong number", "Unattended", "Call Not Connected"):
                daily_calls[cd]["connected"] += 1
            else:
                daily_calls[cd]["not_connected"] += 1
    daily_calls_list = sorted(daily_calls.values(), key=lambda x: x["date"], reverse=True)[:30]

    strengths = []
    improvements = []
    if conv_pct > 15:
        strengths.append(f"Strong conversion rate at {conv_pct:.1f}%")
    if converted > 0:
        strengths.append(f"{converted} successful conversions this period")
    if total_sale > 0:
        strengths.append(f"Generated ₹{total_sale:,.0f} in sales")
    if not_connected > total * 0.3:
        improvements.append(f"High not-connected rate ({not_connected} calls) - review calling times")
    if call_back > 5:
        improvements.append(f"{call_back} leads pending callback - follow up soon")
    if unattended > 3:
        improvements.append(f"{unattended} unattended leads - prioritize these")
    if not improvements:
        improvements.append("Maintain current calling discipline")
    if not strengths:
        strengths.append("Keep building your lead pipeline")

    return {
        "kpi": {
            "total_leads": total,
            "converted": converted,
            "appointments": appointments,
            "will_visit": will_visit,
            "conversion_pct": round(conv_pct, 1),
            "total_sale_amount": total_sale,
            "calls_connected": total - not_connected - wrong_number - unattended,
            "calls_not_connected": not_connected,
            "call_back_later": call_back,
        },
        "status_breakdown": status_breakdown,
        "recent_leads": recent,
        "daily_calls": daily_calls_list,
        "ai_summary": {
            "strengths": strengths,
            "improvements": improvements,
            "tip": f"You have {call_back} callbacks pending. Focus on converting appointments ({appointments}) to close more sales." if call_back > 0 else f"Great work! Focus on converting your {will_visit} will-visit leads into appointments.",
        },
    }
