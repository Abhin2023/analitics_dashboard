"""Dashboard chat bubble: lets a user ask free-form questions about the
company's current performance, answered from the same data snapshot the
AI Summary feature already builds (see ai_summary_service.build_dashboard_context)
— not a live MCP call, so it's fast and can't drift from what the rest of
the dashboard shows.

Deliberately uses a cheap/fast model (Haiku for Claude, gpt-4o-mini for
OpenAI) regardless of whichever model is configured for the heavier
executive-summary feature — a quick Q&A chat doesn't need the same model,
and this keeps per-message cost low. Every exchange is logged to
DashboardChatLog with its real token usage/cost, so actual spend is
directly visible instead of estimated.
"""
import json
import logging
from datetime import date, datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..models.models import DashboardChatLog
from ..instagram.ai_service import ClaudeProvider, OpenAIProvider, ai_service
from .ai_summary_service import _get_ai_credentials, build_dashboard_context

logger = logging.getLogger(__name__)

CHEAP_MODEL_BY_PROVIDER = {
    "claude": "claude-haiku-4-5-20251001",
    "openai": "gpt-4o-mini",
}

MAX_HISTORY_MESSAGES = 6  # last 3 exchanges — enough continuity without re-billing a growing transcript every turn

SYSTEM_PROMPT = """You are a helpful assistant answering questions about Break Protection's (a multi-store retail chain in India, UAE and Oman) current business performance.

You are given a JSON snapshot of this month's real data: revenue, targets, achievement %, top/bottom branches, team leader performance, marketing, staff, reviews, and international stores.

Rules:
- Answer ONLY using the data provided. Never invent numbers, store names, or facts not present in the JSON.
- If the answer isn't in the provided data, say so plainly and suggest which dashboard page might have it, instead of guessing.
- Be concise and conversational — this is a quick chat answer, not a report. 2-4 sentences unless the question needs a short list.
- Use real numbers and names from the data when relevant."""


async def _build_context_text(db: AsyncSession) -> str:
    month = date.today().strftime("%Y-%m")
    context = await build_dashboard_context(db, month)
    return json.dumps(context, default=str)


async def ask_dashboard_chat(
    db: AsyncSession, user_id: int, message: str, history: list[dict]
) -> dict:
    creds = await _get_ai_credentials(db)
    if not creds:
        return {
            "reply": "No AI provider is configured yet — ask an admin to add an API key in Settings → AI Provider Configuration.",
            "usage": None,
        }
    provider_name, api_key, _configured_model = creds
    model = CHEAP_MODEL_BY_PROVIDER.get(provider_name, _configured_model)

    context_text = await _build_context_text(db)
    trimmed_history = (history or [])[-MAX_HISTORY_MESSAGES:]

    messages = [
        {"role": "user", "content": f"Here is this month's dashboard data:\n\n{context_text}"},
        {"role": "assistant", "content": "Understood — I have the current data. Ask me anything about it."},
        *trimmed_history,
        {"role": "user", "content": message},
    ]

    if provider_name == "claude":
        provider = ClaudeProvider(api_key=api_key, model=model)
    else:
        provider = OpenAIProvider(api_key=api_key, model=model)

    try:
        resp = await provider.generate(messages, SYSTEM_PROMPT, max_tokens=600)
    finally:
        await provider.close()

    reply = resp.text.strip() if resp.text else "Sorry, I couldn't generate a response just now — please try again."
    cost = ai_service.estimate_cost(provider_name, resp.input_tokens, resp.output_tokens)

    db.add(DashboardChatLog(
        user_id=user_id, question=message, answer=reply,
        provider=provider_name, model=model,
        input_tokens=resp.input_tokens, output_tokens=resp.output_tokens,
        cost_estimate=cost,
    ))
    await db.commit()

    return {
        "reply": reply,
        "usage": {
            "input_tokens": resp.input_tokens, "output_tokens": resp.output_tokens,
            "cost": round(cost, 6), "model": model,
        },
    }


async def get_chat_usage_summary(db: AsyncSession, days: int = 30) -> dict:
    """Real, measured spend for this feature over the last N days — the
    concrete answer to "will this cost too much," instead of an estimate."""
    since = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    since = since.fromordinal(since.toordinal() - days)
    result = await db.execute(
        select(
            func.count(DashboardChatLog.id),
            func.coalesce(func.sum(DashboardChatLog.input_tokens), 0),
            func.coalesce(func.sum(DashboardChatLog.output_tokens), 0),
            func.coalesce(func.sum(DashboardChatLog.cost_estimate), 0),
        ).where(DashboardChatLog.created_at >= since)
    )
    count, in_tok, out_tok, cost = result.one()
    return {
        "period_days": days,
        "message_count": count,
        "input_tokens": int(in_tok),
        "output_tokens": int(out_tok),
        "total_cost_usd": round(float(cost), 4),
    }
