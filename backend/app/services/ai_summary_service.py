"""AI Executive Summary: aggregates dashboard data, asks Claude/OpenAI for analysis,
and caches structured results (summary + insights + recommendations + chart specs)."""
import asyncio
import hashlib
import json
import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.models import (
    Store, User, DailySubmission, MarketingMetrics, StoreStaff,
    InternationalStore, GoogleReview, DailyStoreTracker, AISummaryConfig, AISummaryRun,
)
from ..instagram.models import AIProvider
from ..instagram.ai_service import ClaudeProvider, OpenAIProvider, ai_service
from ..instagram.utils import decrypt_token
from .ai_section_contexts import (
    build_section_context, SECTION_TITLES, SECTION_DEFAULT_PROMPTS,
)

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_PROMPT = """You are the Chief Analytics Officer of BreakProtection, a multi-store retail chain in India, UAE and Oman.

Analyse the provided JSON dashboard snapshot and produce an executive briefing. Be specific, use real store/TL names and numbers from the data, and never invent data.

Respond ONLY with a single valid JSON object matching exactly this schema:
{
  "summary": "2-4 sentence executive summary of overall performance this month",
  "highlights": ["3-6 short positive callouts, each <= 12 words"],
  "concerns": ["3-6 short risk callouts, each <= 12 words"],
  "recommendations": [
    {"priority": "critical|high|strategic", "title": "short title", "detail": "one or two sentences with store/TL names and numbers", "owner": "suggested owner or role"}
  ],
  "anomalies": [
    {"severity": "critical|warning|info", "store": "store name", "metric": "metric name", "observation": "what is wrong", "suggested_action": "one short sentence"}
  ]
}

Rules:
- recommendations and anomalies: limit to 6 items total each, ordered by importance.
- Use exact store and TL names from the data.
- Put numbers (percentages, amounts) from the data into the text.
- Do NOT wrap the JSON in markdown code fences."""

DEFAULT_MODEL = "claude-sonnet-4-6"

_gen_lock = asyncio.Lock()


def _month_str(d: date = None) -> str:
    d = d or date.today()
    return d.strftime("%Y-%m")


async def get_or_create_config(db: AsyncSession, name: str = "overview") -> AISummaryConfig:
    result = await db.execute(
        select(AISummaryConfig).where(AISummaryConfig.name == name)
    )
    config = result.scalar_one_or_none()
    if not config:
        config = AISummaryConfig(
            name=name,
            system_prompt=SECTION_DEFAULT_PROMPTS.get(name, DEFAULT_SYSTEM_PROMPT),
            provider="claude",
            model_name=DEFAULT_MODEL,
            is_active=True,
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)
    return config


def _fingerprint(payload: dict) -> str:
    return hashlib.md5(
        json.dumps(payload, sort_keys=True, default=str).encode()
    ).hexdigest()


# ── Context builder ────────────────────────────────────────────────────────
async def _ops_context(db: AsyncSession, month: str) -> dict:
    start = date.fromisoformat(f"{month}-01")
    nxt = start.replace(day=28) + timedelta(days=4)
    end = nxt - timedelta(days=nxt.day)

    stores = (await db.execute(select(Store).where(Store.is_active == True))).scalars().all()
    store_ids = [s.id for s in stores]

    tl_names = {}
    tl_ids = {s.id: s.team_leader_id for s in stores}
    for tl_id in set(filter(None, tl_ids.values())):
        r = await db.execute(select(User.name).where(User.id == tl_id))
        tl_names[tl_id] = r.scalar() or "Unassigned"

    store_ach = []
    for s in stores:
        rev = float((await db.execute(
            select(func.coalesce(func.sum(DailySubmission.revenue), 0)).where(
                DailySubmission.store_id == s.id,
                DailySubmission.date >= start,
                DailySubmission.date <= end,
            )
        )).scalar() or 0)
        tgt = float(s.monthly_target or 0)
        walkins = int((await db.execute(
            select(func.coalesce(func.sum(DailySubmission.walk_ins), 0)).where(
                DailySubmission.store_id == s.id,
                DailySubmission.date >= start,
                DailySubmission.date <= end,
            )
        )).scalar() or 0)
        sales = int((await db.execute(
            select(func.coalesce(func.sum(DailySubmission.walk_in_conversions), 0)).where(
                DailySubmission.store_id == s.id,
                DailySubmission.date >= start,
                DailySubmission.date <= end,
            )
        )).scalar() or 0)
        units = int((await db.execute(
            select(func.coalesce(func.sum(DailySubmission.units_sold), 0)).where(
                DailySubmission.store_id == s.id,
                DailySubmission.date >= start,
                DailySubmission.date <= end,
            )
        )).scalar() or 0)
        store_ach.append({
            "store": s.name,
            "tl": tl_names.get(s.team_leader_id, "Unassigned"),
            "mtd": round(rev, 2),
            "target": round(tgt, 2),
            "ach_pct": round(rev / tgt * 100, 1) if tgt > 0 else 0,
            "walkins": walkins,
            "sales": sales,
            "conv_pct": round(sales / walkins * 100, 1) if walkins > 0 else 0,
            "units_sold": units,
        })

    store_ach.sort(key=lambda x: x["ach_pct"], reverse=True)

    total_revenue = sum(s["mtd"] for s in store_ach)
    total_target = sum(s["target"] for s in store_ach)
    total_walkins = sum(s["walkins"] for s in store_ach)
    total_conversions = sum(s["sales"] for s in store_ach)

    rag = {
        "green": sum(1 for s in store_ach if s["ach_pct"] >= 65),
        "amber": sum(1 for s in store_ach if 35 <= s["ach_pct"] < 65),
        "red": sum(1 for s in store_ach if s["ach_pct"] < 35),
    }

    tl_map = {}
    for s in store_ach:
        tl = s["tl"]
        if tl not in tl_map:
            tl_map[tl] = {"name": tl, "target": 0, "achieved": 0, "walkins": 0, "conv": 0, "stores": []}
        tl_map[tl]["target"] += s["target"]
        tl_map[tl]["achieved"] += s["mtd"]
        tl_map[tl]["walkins"] += s["walkins"]
        tl_map[tl]["conv"] += s["sales"]
        tl_map[tl]["stores"].append(s["store"])
    tl_list = []
    for t in tl_map.values():
        t["ach_pct"] = round(t["achieved"] / t["target"] * 100, 1) if t["target"] > 0 else 0
        tl_list.append(t)
    tl_list.sort(key=lambda x: x["achieved"], reverse=True)

    # Daily revenue trend (last 30 days)
    trend_start = date.today() - timedelta(days=29)
    rows = (await db.execute(
        select(DailySubmission.date, func.sum(DailySubmission.revenue))
        .where(DailySubmission.date >= trend_start, DailySubmission.date <= date.today())
        .group_by(DailySubmission.date)
        .order_by(DailySubmission.date)
    )).all()
    trend = [{"date": str(r[0]), "revenue": round(float(r[1] or 0), 2)} for r in rows]

    days_elapsed = max(1, (date.today() - start).days + 1)
    days_in_month = (end - start).days + 1
    pace = round(total_revenue / days_elapsed * days_in_month, 2) if days_elapsed > 0 else total_revenue

    return {
        "kpis": {
            "total_revenue": round(total_revenue, 2),
            "total_target": round(total_target, 2),
            "achievement_pct": round(total_revenue / total_target * 100, 1) if total_target > 0 else 0,
            "total_walkins": total_walkins,
            "total_conversions": total_conversions,
            "conv_pct": round(total_conversions / max(total_walkins, 1) * 100, 1),
            "units_sold": sum(s["units_sold"] for s in store_ach),
            "store_count": len(store_ach),
            "tl_count": len(tl_list),
            "rag": rag,
            "projected_mtd": pace,
            "pace_vs_target_pct": round(pace / total_target * 100, 1) if total_target > 0 else 0,
            "days_elapsed": days_elapsed,
        },
        "top_stores": store_ach[:5],
        "bottom_stores": list(reversed(store_ach[-5:])) if store_ach else [],
        "tl_list": [{"name": t["name"], "achieved": round(t["achieved"], 2), "target": round(t["target"], 2), "ach_pct": t["ach_pct"], "store_count": len(t["stores"])} for t in tl_list],
        "revenue_trend": trend,
    }


async def _marketing_context(db: AsyncSession, month: str) -> dict:
    rows = (await db.execute(
        select(DailyStoreTracker).where(DailyStoreTracker.date.like(f"{month}%"))
    )).scalars().all()

    totals = {
        "ig_views": 0, "yt_views": 0, "tt_views": 0, "sc_views": 0,
        "ig_engagements": 0, "yt_engagements": 0, "tt_engagements": 0,
        "ig_followers_new": 0, "wa_chats": 0, "wa_walkins": 0,
        "prebookings": 0, "google_reviews": 0,
    }
    store_map = {}
    for r in rows:
        s = r.store_name
        if not s:
            continue
        m = store_map.setdefault(s, {
            "store": s, "ig_views": 0, "ig_followers": 0, "ig_engagements": 0,
            "wa_chats": 0, "wa_walkins": 0, "google_rating": None, "google_reviews": 0,
        })
        m["ig_views"] += r.ig_views_achieved or 0
        m["ig_engagements"] += (r.ig_likes or 0) + (r.ig_comments or 0) + (r.ig_saves or 0) + (r.ig_shares or 0)
        m["wa_chats"] += r.wa_chats_received or 0
        m["wa_walkins"] += r.wa_walkins_booked or 0
        m["google_reviews"] += r.google_new_reviews or 0
        if r.google_rating:
            m["google_rating"] = r.google_rating
        if r.ig_new_followers:
            m["ig_followers"] += r.ig_new_followers

        totals["ig_views"] += r.ig_views_achieved or 0
        totals["yt_views"] += r.yt_views or 0
        totals["tt_views"] += r.tt_views or 0
        totals["sc_views"] += r.sc_views or 0
        totals["ig_engagements"] += (r.ig_likes or 0) + (r.ig_comments or 0) + (r.ig_saves or 0) + (r.ig_shares or 0)
        totals["yt_engagements"] += (r.yt_likes or 0) + (r.yt_comments or 0)
        totals["tt_engagements"] += r.tt_likes or 0
        totals["ig_followers_new"] += r.ig_new_followers or 0
        totals["wa_chats"] += r.wa_chats_received or 0
        totals["wa_walkins"] += r.wa_walkins_booked or 0
        totals["prebookings"] += r.prebookings or 0
        totals["google_reviews"] += r.google_new_reviews or 0

    stores = sorted(store_map.values(), key=lambda x: x["ig_views"], reverse=True)
    low_engagement = [s for s in stores if s["ig_views"] > 0 and s["ig_engagements"] / max(s["ig_views"], 1) < 0.03]
    low_rating = [s for s in stores if s["google_rating"] and s["google_rating"] < 4.0]

    return {
        "totals": totals,
        "total_social_views": sum([totals["ig_views"], totals["yt_views"], totals["tt_views"], totals["sc_views"]]),
        "top_stores": stores[:5],
        "low_engagement_stores": [s["store"] for s in low_engagement],
        "low_rating_stores": [s["store"] for s in low_rating],
    }


async def _staff_context(db: AsyncSession, month: str) -> dict:
    rows = (await db.execute(
        select(StoreStaff).where(StoreStaff.month == month)
    )).scalars().all()
    total = sum(r.total_headcount or r.staff_count or 0 for r in rows)
    risk = [r for r in rows if (r.resignation_risk or 0) > 0]
    training = [r for r in rows if r.training_active]
    store_names = {}
    for r in risk + training:
        if r.store_id not in store_names:
            q = await db.execute(select(Store.name).where(Store.id == r.store_id))
            store_names[r.store_id] = q.scalar() or "Unknown"
    return {
        "total_headcount": total,
        "stores_with_resignation_risk": [store_names.get(r.store_id, "Unknown") for r in risk],
        "stores_in_training": [store_names.get(r.store_id, "Unknown") for r in training],
    }


async def _reviews_context(db: AsyncSession, month: str) -> dict:
    rows = (await db.execute(
        select(GoogleReview, Store).join(Store, GoogleReview.store_id == Store.id)
    )).all()
    ratings = [float(gr.rating) for gr, _ in rows if gr.rating is not None]
    new_reviews = sum(gr.new_reviews or 0 for gr, _ in rows)
    return {
        "store_count": len(rows),
        "avg_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
        "new_reviews_total": new_reviews,
    }


async def _intl_context(db: AsyncSession, month: str) -> dict:
    rows = (await db.execute(
        select(InternationalStore).where(InternationalStore.month == month)
    )).scalars().all()
    by_country = {}
    for r in rows:
        c = by_country.setdefault(r.country, {"country": r.country, "target": 0, "actual": 0, "stores": 0})
        c["target"] += float(r.target or 0)
        c["actual"] += float(r.actual or 0)
        c["stores"] += 1
    out = []
    for c in by_country.values():
        c["pct"] = round(c["actual"] / c["target"] * 100, 1) if c["target"] > 0 else 0
        out.append(c)
    return out


async def build_dashboard_context(db: AsyncSession, month: str) -> dict:
    ops = await _ops_context(db, month)
    marketing = await _marketing_context(db, month)
    staff = await _staff_context(db, month)
    reviews = await _reviews_context(db, month)
    intl = await _intl_context(db, month)
    return {
        "month": month,
        "ops": ops,
        "marketing": marketing,
        "staff": staff,
        "reviews": reviews,
        "international": intl,
    }


# ── AI generation ─────────────────────────────────────────────────────────
async def _get_ai_credentials(db: AsyncSession) -> tuple[str, str, str] | None:
    result = await db.execute(select(AIProvider).where(AIProvider.is_active == True))
    provider = result.scalar_one_or_none()
    if not provider:
        return None
    try:
        api_key = decrypt_token(provider.api_key_encrypted)
    except Exception as e:
        logger.error("Failed to decrypt AI provider key: %s", e)
        return None
    if not api_key or api_key == "NOT_CONFIGURED":
        return None
    return provider.provider, api_key, provider.model_name or ""


def _extract_json(text: str):
    fences = re.findall(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    candidate = fences[0].strip() if fences else text.strip()
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(candidate[start:end + 1])
            except json.JSONDecodeError:
                return None
    return None


def _validate_response(data: dict) -> dict:
    out = {
        "summary": str(data.get("summary", "")),
        "highlights": data.get("highlights") or [],
        "concerns": data.get("concerns") or [],
        "recommendations": data.get("recommendations") or [],
        "anomalies": data.get("anomalies") or [],
    }
    return out


def _fallback_summary(context: dict) -> dict:
    ops = context["ops"]["kpis"]
    mkt = context["marketing"]
    rag = ops["rag"]
    top = context["ops"]["top_stores"]
    bottom = context["ops"]["bottom_stores"]

    summary = (
        f"India is at {ops['achievement_pct']}% of monthly target "
        f"(\u20b9{ops['total_revenue']:,.0f} vs \u20b9{ops['total_target']:,.0f}), "
        f"with {rag['green']} green, {rag['amber']} amber and {rag['red']} red stores. "
        f"Walk-ins total {ops['total_walkins']:,} with {ops['conv_pct']}% conversion. "
        f"At current pace the month is projected to close at {ops['projected_mtd']:,.0f} "
        f"({ops['pace_vs_target_pct']}% of target)."
    )

    highlights = []
    if top:
        t = top[0]
        highlights.append(f"Top store: {t['store']} at {t['ach_pct']}%")
    if mkt["totals"]["wa_walkins"]:
        highlights.append(f"{mkt['totals']['wa_walkins']} WhatsApp walk-ins this month")
    if mkt["totals"]["ig_followers_new"]:
        highlights.append(f"{mkt['totals']['ig_followers_new']} new IG followers")

    concerns = []
    if rag["red"]:
        concerns.append(f"{rag['red']} stores below 35% target")
    if mkt["low_engagement_stores"]:
        concerns.append(f"Low social engagement: {', '.join(mkt['low_engagement_stores'][:3])}")
    if mkt["low_rating_stores"]:
        concerns.append(f"Google rating < 4.0: {', '.join(mkt['low_rating_stores'][:3])}")

    recommendations = []
    for s in bottom[:3]:
        recommendations.append({
            "priority": "critical" if s["ach_pct"] < 35 else "high",
            "title": f"Review {s['store']} performance",
            "detail": f"{s['store']} is at {s['ach_pct']}% with \u20b9{s['mtd']:,.0f} revenue vs target \u20b9{s['target']:,.0f}.",
            "owner": s["tl"],
        })
    if mkt["low_engagement_stores"]:
        recommendations.append({
            "priority": "high",
            "title": "Improve social engagement",
            "detail": f"Stores {', '.join(mkt['low_engagement_stores'][:3])} show below 3% engagement rate on Instagram.",
            "owner": "Marketing / TL",
        })

    anomalies = []
    for s in bottom[:3]:
        anomalies.append({
            "severity": "critical" if s["ach_pct"] < 35 else "warning",
            "store": s["store"],
            "metric": "MTD achievement",
            "observation": f"Only {s['ach_pct']}% of target achieved.",
            "suggested_action": "Review pipeline and marketing spend with the TL.",
        })

    return {
        "summary": summary,
        "highlights": highlights,
        "concerns": concerns,
        "recommendations": recommendations[:6],
        "anomalies": anomalies[:6],
    }


def _fallback_section_summary(context: dict, section: str) -> dict:
    kpis = context.get("kpis") or {}
    title = SECTION_TITLES.get(section, section.replace("_", " ").title())

    def _fmt(k):
        v = kpis.get(k)
        if isinstance(v, float):
            return f"{v:,.1f}"
        if isinstance(v, int):
            return f"{v:,}"
        return str(v) if v is not None else "0"

    parts = []
    for key in ("total_revenue", "total_invested", "total_budget", "total_leads", "total_tasks", "store_count"):
        if kpis.get(key) is not None:
            parts.append(f"{_fmt(key)} {key.replace('_', ' ')}")
            break
    for key in ("achievement_pct", "conv_pct", "submission_rate_pct", "avg_total_score", "avg_success_rate"):
        if kpis.get(key) is not None:
            parts.append(f"{key.replace('_', ' ')} {_fmt(key)}")
            break

    summary = f"{title}: current snapshot shows {', '.join(parts) if parts else 'limited data'}."
    highlights = [h for h in (context.get("highlights_auto") or []) if h][:5] or [
        "Data loaded successfully for this section."
    ]
    concerns = [c for c in (context.get("concerns_auto") or []) if c][:5] or [
        "No major risks flagged in the current data."
    ]

    recommendations = []
    for b in (context.get("bottom") or [])[:3]:
        recommendations.append({
            "priority": "high",
            "title": f"Review {b['name']}",
            "detail": f"{b['name']} shows {b.get('sub', '')} — investigate the cause and action plan.",
            "owner": "Ops Lead",
        })
    anomalies = []
    for b in (context.get("bottom") or [])[:3]:
        anomalies.append({
            "severity": "warning",
            "store": b["name"],
            "metric": "performance",
            "observation": f"{b['name']} is in the bottom of the current ranking.",
            "suggested_action": "Review recent activity and correct course.",
        })
    return {
        "summary": summary,
        "highlights": highlights,
        "concerns": concerns,
        "recommendations": recommendations[:5],
        "anomalies": anomalies[:5],
    }


async def generate_summary(db: AsyncSession, month: str, section: str = "overview",
                           force: bool = False, user_id: Optional[int] = None) -> dict:
    async with _gen_lock:
        return await _generate_summary(db, month, section=section, force=force, user_id=user_id)


async def _generate_summary(db: AsyncSession, month: str, section: str = "overview",
                            force: bool = False, user_id: Optional[int] = None) -> dict:
    config = await get_or_create_config(db, section)
    context = await build_section_context(db, section, month)
    fp = _fingerprint(context)

    if not force:
        result = await db.execute(
            select(AISummaryRun).where(
                AISummaryRun.config_id == config.id,
                AISummaryRun.period == month,
                AISummaryRun.status == "ok",
            ).order_by(AISummaryRun.generated_at.desc()).limit(1)
        )
        cached = result.scalar_one_or_none()
        if cached and cached.input_fingerprint == fp:
            data = cached.response_json or {}
            stored_meta = data.get("_meta") or {}
            data["_meta"] = {
                "generated_at": cached.generated_at.isoformat() if cached.generated_at else None,
                "provider": stored_meta.get("provider") or cached.provider,
                "model": stored_meta.get("model") or cached.model,
                "input_tokens": stored_meta.get("input_tokens") or cached.input_tokens,
                "output_tokens": stored_meta.get("output_tokens") or cached.output_tokens,
                "cost": float(stored_meta.get("cost") or cached.cost_estimate or 0),
                "cached": True,
                "used_fallback": stored_meta.get("ai_status") != "ok",
                "ai_status": stored_meta.get("ai_status") or "fallback",
                "error": stored_meta.get("error"),
                "no_summary": False,
                "stale": False,
            }
            data["context"] = context
            return data

    creds = await _get_ai_credentials(db)
    if section == "overview":
        fallback = _fallback_summary(context)
    else:
        fallback = _fallback_section_summary(context, section)
    meta = {"generated_at": datetime.now().isoformat(), "provider": None, "model": None,
            "input_tokens": 0, "output_tokens": 0, "cost": 0.0, "cached": False,
            "used_fallback": True, "ai_status": "fallback",
            "error": None, "no_summary": False, "stale": False}

    if creds:
        provider_name, api_key, model = creds
        model = config.model_name or model or DEFAULT_MODEL
        payload = json.dumps(context, default=str)
        user_prompt = (
            f"Here is the {SECTION_TITLES.get(section, section)} dashboard snapshot JSON for {month}. "
            f"Analyze it and respond with the JSON object.\n\n"
            f"{payload}"
        )
        try:
            if provider_name == "claude":
                provider = ClaudeProvider(api_key=api_key, model=model)
            else:
                provider = OpenAIProvider(api_key=api_key, model=model or "gpt-4o")
            system = config.system_prompt or SECTION_DEFAULT_PROMPTS.get(section, DEFAULT_SYSTEM_PROMPT)
            resp = await provider.generate([{"role": "user", "content": user_prompt}], system, max_tokens=4096)
            await provider.close()

            parsed = _extract_json(resp.text)
            if parsed:
                fallback = _validate_response(parsed)
            else:
                meta["error"] = "AI responded but the output could not be parsed as JSON."
            meta.update({
                "provider": provider_name,
                "model": model,
                "input_tokens": resp.input_tokens,
                "output_tokens": resp.output_tokens,
                "cost": round(ai_service.estimate_cost(provider_name, resp.input_tokens, resp.output_tokens), 6),
                "used_fallback": parsed is None,
                "ai_status": "ok" if parsed else "error",
            })
        except Exception as e:
            logger.error("AI summary generation error: %s", e)
            meta["error"] = str(e)
            meta["ai_status"] = "error"

    fallback["_meta"] = meta
    run = AISummaryRun(
        config_id=config.id,
        period=month,
        input_fingerprint=fp,
        status="ok",
        response_json=fallback,
        provider=meta["provider"] or config.provider,
        model=meta["model"] or config.model_name,
        input_tokens=meta["input_tokens"],
        output_tokens=meta["output_tokens"],
        cost_estimate=meta["cost"],
    )
    db.add(run)
    await db.commit()

    fallback["context"] = context
    return fallback


async def get_summary(db: AsyncSession, month: str, section: str = "overview",
                      user_id: Optional[int] = None) -> dict:
    """Read-only: return the latest cached summary for this section+month without
    calling the AI. Never regenerates — generation happens only on explicit
    regenerate (generate_summary with force)."""
    config = await get_or_create_config(db, section)
    context = await build_section_context(db, section, month)
    fp = _fingerprint(context)

    result = await db.execute(
        select(AISummaryRun).where(
            AISummaryRun.config_id == config.id,
            AISummaryRun.period == month,
        ).order_by(AISummaryRun.generated_at.desc()).limit(1)
    )
    cached = result.scalar_one_or_none()

    if not cached:
        return {
            "summary": "",
            "highlights": [],
            "concerns": [],
            "recommendations": [],
            "anomalies": [],
            "context": context,
            "_meta": {
                "generated_at": None,
                "provider": None,
                "model": None,
                "input_tokens": 0,
                "output_tokens": 0,
                "cost": 0.0,
                "cached": False,
                "used_fallback": False,
                "ai_status": None,
                "error": None,
                "no_summary": True,
                "stale": False,
            },
        }

    data = cached.response_json or {}
    stored_meta = data.get("_meta") or {}
    data["_meta"] = {
        "generated_at": cached.generated_at.isoformat() if cached.generated_at else None,
        "provider": stored_meta.get("provider") or cached.provider,
        "model": stored_meta.get("model") or cached.model,
        "input_tokens": stored_meta.get("input_tokens") or cached.input_tokens,
        "output_tokens": stored_meta.get("output_tokens") or cached.output_tokens,
        "cost": float(stored_meta.get("cost") or cached.cost_estimate or 0),
        "cached": True,
        "used_fallback": stored_meta.get("ai_status") != "ok",
        "ai_status": stored_meta.get("ai_status") or "fallback",
        "error": stored_meta.get("error"),
        "no_summary": False,
        "stale": cached.input_fingerprint != fp,
    }
    data["context"] = context
    return data
