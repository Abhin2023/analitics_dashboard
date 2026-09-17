"""Detects real, data-backed issues automatically instead of relying on a
human to type them into the gr_action_plan Google Sheet — see
StrategicInsight.source. Every rule here reads from data this session's
work already verified as accurate (McpDailySale for revenue/target,
DailySubmission for India walk-in/call funnel metrics), so what shows up
on the CEO Dashboard's Action Center is a live reflection of current
numbers rather than whatever was last manually written down.

Designed to run on a schedule (see app/workers/scheduler.py) — each run
deletes its own previous output for the current month (source="auto") and
recomputes fresh, so a resolved issue disappears on its own and nothing
piles up across runs. Manually-authored / Sheet-synced insights
(source="manual") are never touched.
"""
import calendar
import logging
from datetime import date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete as sa_delete

from ..models.models import (
    Store, StoreMcpAlias, McpDailySale, DailySubmission, User,
    StrategicInsight, InsightResolutionLog,
)

logger = logging.getLogger(__name__)

SECTION = "actions"


def _month_str(d: date) -> str:
    return d.strftime("%Y-%m")


async def _confirmed_targeted_stores(db: AsyncSession) -> list[Store]:
    """Active, confirmed stores that MCP actually maintains a target for —
    same alias-gating sales_report_service.py uses, so an insight is never
    raised against a stale/legacy target on a store MCP doesn't track."""
    aliased_ids = {row[0] for row in (await db.execute(
        select(StoreMcpAlias.store_id).distinct()
    )).all()}
    if not aliased_ids:
        return []
    result = await db.execute(
        select(Store).where(
            Store.id.in_(aliased_ids), Store.needs_review == False,
            Store.is_active == True, Store.monthly_target > 0,
        )
    )
    return result.scalars().all()


async def _revenue_between(db: AsyncSession, store_id: int, start: date, end: date) -> float:
    result = await db.execute(
        select(func.coalesce(func.sum(McpDailySale.revenue), 0)).where(
            McpDailySale.store_id == store_id,
            McpDailySale.date >= start, McpDailySale.date <= end,
        )
    )
    return float(result.scalar() or 0)


async def _tl_name(db: AsyncSession, store: Store) -> str:
    if not store.team_leader_id:
        return ""
    result = await db.execute(select(User.name).where(User.id == store.team_leader_id))
    return result.scalar() or ""


async def _rule_behind_pace(db: AsyncSession, today: date, stores: list[Store]) -> list[StrategicInsight]:
    """A store's month-to-date revenue is badly behind the straight-line
    pace needed to hit its own monthly target by month end."""
    out = []
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    days_elapsed = today.day
    if days_elapsed < 5:
        return out  # too early in the month for pace to mean anything yet
    month_start = today.replace(day=1)
    for store in stores:
        target = float(store.monthly_target or 0)
        expected = target * (days_elapsed / days_in_month)
        if expected <= 0:
            continue
        actual = await _revenue_between(db, store.id, month_start, today)
        if actual < 0.6 * expected:
            pct = round(actual / expected * 100) if expected else 0
            tl = await _tl_name(db, store)
            out.append(StrategicInsight(
                month=_month_str(today), category="critical", priority="critical",
                section=SECTION, source="auto", rule_key=f"behind_pace:{store.id}",
                title=store.name,
                description=(
                    f"Behind pace to hit its monthly target: {actual:,.0f} achieved vs "
                    f"{expected:,.0f} expected by day {days_elapsed}/{days_in_month} "
                    f"({pct}% of pace), target {target:,.0f}."
                ),
                action_tag="Review this branch's performance with its team leader",
                assigned_to=tl, deadline=today.replace(day=days_in_month).isoformat(),
            ))
    return out


async def _rule_revenue_drop(db: AsyncSession, today: date, stores: list[Store]) -> list[StrategicInsight]:
    """Flags a store whose revenue this week is either zero or sharply down
    vs the prior week, relative to what a typical week should look like for
    that store's own target — keeps the threshold meaningful across
    branches of very different sizes without needing a currency-specific
    cutoff."""
    out = []
    this_week_start = today - timedelta(days=6)
    last_week_start = today - timedelta(days=13)
    last_week_end = today - timedelta(days=7)
    for store in stores:
        weekly_target = float(store.monthly_target or 0) / 4.345
        if weekly_target <= 0:
            continue
        last_week = await _revenue_between(db, store.id, last_week_start, last_week_end)
        this_week = await _revenue_between(db, store.id, this_week_start, today)
        # Only meaningful if last week was itself a real trading week (at
        # least 10% of an average week's target) — otherwise a branch going
        # from near-nothing to near-nothing isn't a "drop" worth flagging.
        if last_week < 0.1 * weekly_target:
            continue
        if this_week == 0:
            tl = await _tl_name(db, store)
            out.append(StrategicInsight(
                month=_month_str(today), category="critical", priority="critical",
                section=SECTION, source="auto", rule_key=f"zero_revenue_week:{store.id}",
                title=store.name,
                description=f"Zero revenue in the last 7 days, vs {last_week:,.0f} the week before — check for a sync gap or a closed/inactive branch.",
                action_tag="Confirm branch is trading and syncing correctly",
                assigned_to=tl, deadline=today.isoformat(),
            ))
        elif this_week < 0.6 * last_week:
            drop_pct = round((1 - this_week / last_week) * 100)
            tl = await _tl_name(db, store)
            out.append(StrategicInsight(
                month=_month_str(today), category="warning", priority="high",
                section=SECTION, source="auto", rule_key=f"revenue_drop:{store.id}",
                title=store.name,
                description=f"Revenue down {drop_pct}% vs last week: {this_week:,.0f} this week vs {last_week:,.0f} last week.",
                action_tag="Investigate cause of the drop with the team leader",
                assigned_to=tl, deadline=today.isoformat(),
            ))
    return out


async def _rule_funnel_drop(db: AsyncSession, today: date) -> list[StrategicInsight]:
    """Walk-in conversion rate or call-connect rate dropped sharply vs last
    week — India-only, since that's the only place this funnel data is
    manually logged (Google Sheets daily submissions)."""
    out = []
    this_week_start = today - timedelta(days=6)
    last_week_start = today - timedelta(days=13)
    last_week_end = today - timedelta(days=7)

    async def _funnel_totals(store_id: int, start: date, end: date) -> dict:
        result = await db.execute(
            select(
                func.coalesce(func.sum(DailySubmission.walk_ins), 0),
                func.coalesce(func.sum(DailySubmission.walk_in_conversions), 0),
                func.coalesce(func.sum(DailySubmission.calls_made), 0),
                func.coalesce(func.sum(DailySubmission.calls_connected), 0),
            ).where(DailySubmission.store_id == store_id, DailySubmission.date >= start, DailySubmission.date <= end)
        )
        walkins, conv, calls, connected = result.one()
        return {"walkins": walkins or 0, "conv": conv or 0, "calls": calls or 0, "connected": connected or 0}

    stores = (await db.execute(
        select(Store).where(Store.country == "India", Store.is_active == True, Store.needs_review == False)
    )).scalars().all()

    for store in stores:
        this_wk = await _funnel_totals(store.id, this_week_start, today)
        last_wk = await _funnel_totals(store.id, last_week_start, last_week_end)
        tl = None

        if last_wk["walkins"] >= 5 and this_wk["walkins"] >= 3:
            conv_this = this_wk["conv"] / this_wk["walkins"] * 100
            conv_last = last_wk["conv"] / last_wk["walkins"] * 100
            if conv_last - conv_this >= 15:
                tl = tl if tl is not None else await _tl_name(db, store)
                out.append(StrategicInsight(
                    month=_month_str(today), category="warning", priority="high",
                    section=SECTION, source="auto", rule_key=f"conv_drop:{store.id}",
                    title=store.name,
                    description=f"Walk-in conversion rate dropped: {conv_this:.0f}% this week vs {conv_last:.0f}% last week.",
                    action_tag="Coach staff on walk-in conversion technique",
                    assigned_to=tl, deadline=today.isoformat(),
                ))

        if last_wk["calls"] >= 5 and this_wk["calls"] >= 3:
            call_this = this_wk["connected"] / this_wk["calls"] * 100
            call_last = last_wk["connected"] / last_wk["calls"] * 100
            if call_last - call_this >= 15:
                tl = tl if tl is not None else await _tl_name(db, store)
                out.append(StrategicInsight(
                    month=_month_str(today), category="warning", priority="high",
                    section=SECTION, source="auto", rule_key=f"call_rate_drop:{store.id}",
                    title=store.name,
                    description=f"Call connect rate dropped: {call_this:.0f}% this week vs {call_last:.0f}% last week.",
                    action_tag="Review calling list quality and follow-up timing",
                    assigned_to=tl, deadline=today.isoformat(),
                ))
    return out


async def generate_auto_insights(db: AsyncSession) -> dict:
    """Recomputes every auto-detected insight for the current month from
    scratch and replaces whatever this engine previously wrote — resolved
    issues simply stop being regenerated and disappear, nothing piles up.
    Manual/Sheet-synced insights (source="manual") are never touched."""
    today = date.today()
    month = _month_str(today)

    await db.execute(sa_delete(StrategicInsight).where(
        StrategicInsight.month == month, StrategicInsight.source == "auto",
    ))

    stores = await _confirmed_targeted_stores(db)
    generated: list[StrategicInsight] = []
    try:
        generated += await _rule_behind_pace(db, today, stores)
        generated += await _rule_revenue_drop(db, today, stores)
        generated += await _rule_funnel_drop(db, today)
    except Exception:
        logger.exception("Insight engine rule failed partway — writing whatever was computed so far.")

    for i, insight in enumerate(generated):
        insight.sort_order = i
        db.add(insight)

    await _update_resolution_log(db, today, month, generated)

    await db.commit()
    return {"generated": len(generated)}


async def _update_resolution_log(
    db: AsyncSession, today: date, month: str, generated: list[StrategicInsight]
) -> None:
    """Feedback loop: records when each detected condition first appeared,
    keeps it marked open for as long as it keeps reappearing, and marks it
    resolved the run it stops reappearing — without this, there's no way
    to ever tell whether the engine's rules are catching real, fixable
    problems or just noise. See get_insight_stats() for how this is
    surfaced."""
    now = datetime.utcnow()
    current_keys = {i.rule_key: i for i in generated}

    existing = (await db.execute(
        select(InsightResolutionLog).where(InsightResolutionLog.rule_key.in_(current_keys.keys()))
    )).scalars().all() if current_keys else []
    existing_by_key = {e.rule_key: e for e in existing}

    for key, insight in current_keys.items():
        log = existing_by_key.get(key)
        if log is None:
            db.add(InsightResolutionLog(
                rule_key=key, title=insight.title, priority=insight.priority, month=month,
                first_detected_at=now, last_seen_at=now, resolved_at=None,
            ))
        elif log.resolved_at is not None:
            # Recurred after previously being marked resolved — treat as a
            # fresh incident rather than silently extending the old one.
            log.first_detected_at = now
            log.last_seen_at = now
            log.resolved_at = None
        else:
            log.last_seen_at = now

    # Anything still open from a previous run that didn't reappear this
    # time has been resolved.
    still_open = (await db.execute(
        select(InsightResolutionLog).where(InsightResolutionLog.resolved_at.is_(None))
    )).scalars().all()
    for log in still_open:
        if log.rule_key not in current_keys:
            log.resolved_at = now


async def get_insight_stats(db: AsyncSession, month: str) -> dict:
    """Summarizes the insight engine's own track record for a month: how
    many issues it raised, how many got resolved, and how long that took
    on average — the honest, measurable version of "the system is getting
    smarter" (the rules themselves don't change automatically, but you can
    see whether they're catching real, fixable problems)."""
    rows = (await db.execute(
        select(InsightResolutionLog).where(InsightResolutionLog.month == month)
    )).scalars().all()
    resolved = [r for r in rows if r.resolved_at is not None]
    open_now = [r for r in rows if r.resolved_at is None]
    avg_hours = None
    if resolved:
        total_seconds = sum((r.resolved_at - r.first_detected_at).total_seconds() for r in resolved)
        avg_hours = round(total_seconds / len(resolved) / 3600, 1)
    return {
        "month": month,
        "total_raised": len(rows),
        "resolved_count": len(resolved),
        "open_count": len(open_now),
        "avg_resolution_hours": avg_hours,
    }
