"""AI Executive Summary endpoints."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...core.deps import get_db, get_current_user, get_user_permissions, require_permission
from ...models.models import User, Role, AISummaryConfig
from ...services.ai_summary_service import get_summary, generate_summary, get_or_create_config, DEFAULT_SYSTEM_PROMPT, DEFAULT_MODEL
from ...services.ai_section_contexts import SECTION_VIEW_RESOURCE, SECTION_DEFAULT_PROMPTS

router = APIRouter(prefix="/ai-analytics", tags=["ai-analytics"])

MANAGE_ROLES = {"SuperAdmin", "Admin", "CEO"}

KNOWN_SECTIONS = set(SECTION_VIEW_RESOURCE.keys()) | {"overview"}


async def require_ai_manage(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    perms = await get_user_permissions(user, db)
    if any(p["resource"] == "ai_analytics" and p["action"] == "manage" for p in perms):
        return user
    role_name = (await db.execute(select(Role.name).where(Role.id == user.role_id))).scalar_one_or_none() or ""
    if role_name in MANAGE_ROLES:
        return user
    raise HTTPException(status_code=403, detail="Missing permission: ai_analytics:manage")


async def _check_view(section: str, user: User, db: AsyncSession) -> None:
    if section not in KNOWN_SECTIONS:
        raise HTTPException(status_code=404, detail=f"Unknown section: {section}")
    resource = SECTION_VIEW_RESOURCE.get(section, "dashboard")
    perms = await get_user_permissions(user, db)
    if any(p["resource"] == resource and p["action"] == "view" for p in perms):
        return
    role_name = (await db.execute(select(Role.name).where(Role.id == user.role_id))).scalar_one_or_none() or ""
    if role_name in MANAGE_ROLES:
        return
    raise HTTPException(status_code=403, detail=f"Missing permission: {resource}:view")


def _month(month: str = None) -> str:
    return month or date.today().strftime("%Y-%m")


@router.get("/summary")
async def ai_summary(
    section: str = "overview",
    month: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _check_view(section, user, db)
    return await get_summary(db, _month(month), section=section)


@router.post("/summary/regenerate")
async def ai_summary_regenerate(
    section: str = "overview",
    month: str = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_ai_manage),
):
    return await generate_summary(db, _month(month), section=section, force=True, user_id=user.id)


class AISummaryConfigUpdate(BaseModel):
    system_prompt: str = Field(default="", max_length=20000)
    provider: str = Field(default="claude", pattern="^(claude|openai)$")
    model_name: str = Field(default="", max_length=100)


@router.get("/config")
async def ai_config(
    section: str = "overview",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_ai_manage),
):
    if section not in KNOWN_SECTIONS:
        raise HTTPException(status_code=404, detail=f"Unknown section: {section}")
    config = await get_or_create_config(db, section)
    return {
        "id": config.id,
        "name": config.name,
        "system_prompt": config.system_prompt or SECTION_DEFAULT_PROMPTS.get(section, DEFAULT_SYSTEM_PROMPT),
        "provider": config.provider,
        "model_name": config.model_name or DEFAULT_MODEL,
        "is_active": config.is_active,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }


@router.put("/config")
async def ai_config_update(
    body: AISummaryConfigUpdate,
    section: str = "overview",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_ai_manage),
):
    if section not in KNOWN_SECTIONS:
        raise HTTPException(status_code=404, detail=f"Unknown section: {section}")
    config = await get_or_create_config(db, section)
    if body.system_prompt:
        config.system_prompt = body.system_prompt
    config.provider = body.provider
    config.model_name = body.model_name or DEFAULT_MODEL
    config.updated_by = user.id
    await db.commit()
    await db.refresh(config)
    return {
        "id": config.id,
        "name": config.name,
        "system_prompt": config.system_prompt,
        "provider": config.provider,
        "model_name": config.model_name,
        "is_active": config.is_active,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }
