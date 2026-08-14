from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ...core.deps import get_db, require_permission
from ...models.models import Campaign, User
from ...schemas import CampaignCreate, CampaignUpdate, CampaignResponse

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("/", response_model=list[CampaignResponse])
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("campaigns", "view"),
):
    result = await db.execute(select(Campaign).order_by(Campaign.created_at.desc()))
    return [CampaignResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    body: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("campaigns", "create"),
):
    c = Campaign(
        name=body.name, channel=body.channel, start_date=body.start_date,
        end_date=body.end_date, budget=body.budget, status=body.status,
        success_rate=body.success_rate,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return CampaignResponse.model_validate(c)


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("campaigns", "view"),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return CampaignResponse.model_validate(c)


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: int, body: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("campaigns", "edit"),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    await db.commit()
    await db.refresh(c)
    return CampaignResponse.model_validate(c)


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("campaigns", "delete"),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await db.delete(c)
    await db.commit()
    return {"message": "Campaign deleted"}
