from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ...core.deps import get_db, require_permission
from ...models.models import KPIWeight, IncentiveBand, Setting, User
from ...schemas import (
    KPIWeightResponse, KPIWeightsBulkUpdate,
    IncentiveBandCreate, IncentiveBandUpdate, IncentiveBandResponse,
    SettingUpdate, SettingResponse,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/kpi-weights", response_model=list[KPIWeightResponse])
async def list_kpi_weights(
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("settings", "view"),
):
    result = await db.execute(select(KPIWeight).order_by(KPIWeight.kpi_name))
    return [KPIWeightResponse.model_validate(k) for k in result.scalars().all()]


@router.put("/kpi-weights")
async def update_kpi_weights(
    body: KPIWeightsBulkUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("settings", "edit"),
):
    total = sum(w.weight for w in body.weights)
    if abs(total - 1.0) > 0.01:
        raise HTTPException(status_code=400, detail=f"Weights must sum to 1.00, got {total:.2f}")

    for w in body.weights:
        existing = await db.execute(select(KPIWeight).where(KPIWeight.kpi_name == w.kpi_name))
        kpi = existing.scalar_one_or_none()
        if kpi:
            kpi.weight = w.weight
        else:
            db.add(KPIWeight(kpi_name=w.kpi_name, weight=w.weight))
    await db.commit()
    return {"message": "KPI weights updated"}


@router.get("/incentive-bands", response_model=list[IncentiveBandResponse])
async def list_incentive_bands(
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("settings", "view"),
):
    result = await db.execute(select(IncentiveBand).order_by(IncentiveBand.min_kpi_score.desc()))
    return [IncentiveBandResponse.model_validate(b) for b in result.scalars().all()]


@router.post("/incentive-bands", response_model=IncentiveBandResponse)
async def create_incentive_band(
    body: IncentiveBandCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("settings", "create"),
):
    band = IncentiveBand(
        band_name=body.band_name, min_kpi_score=body.min_kpi_score,
        multiplier=body.multiplier, label=body.label,
    )
    db.add(band)
    await db.commit()
    await db.refresh(band)
    return IncentiveBandResponse.model_validate(band)


@router.put("/incentive-bands/{band_id}", response_model=IncentiveBandResponse)
async def update_incentive_band(
    band_id: int, body: IncentiveBandUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("settings", "edit"),
):
    result = await db.execute(select(IncentiveBand).where(IncentiveBand.id == band_id))
    band = result.scalar_one_or_none()
    if not band:
        raise HTTPException(status_code=404, detail="Band not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(band, field, value)
    await db.commit()
    await db.refresh(band)
    return IncentiveBandResponse.model_validate(band)


@router.delete("/incentive-bands/{band_id}")
async def delete_incentive_band(
    band_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("settings", "delete"),
):
    result = await db.execute(select(IncentiveBand).where(IncentiveBand.id == band_id))
    band = result.scalar_one_or_none()
    if not band:
        raise HTTPException(status_code=404, detail="Band not found")
    await db.delete(band)
    await db.commit()
    return {"message": "Band deleted"}


@router.get("/all", response_model=list[SettingResponse])
async def list_settings(
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("settings", "view"),
):
    result = await db.execute(select(Setting))
    return [SettingResponse(key=s.key, value=s.value, updated_at=s.updated_at) for s in result.scalars().all()]


@router.put("/")
async def update_setting(
    body: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = require_permission("settings", "edit"),
):
    result = await db.execute(select(Setting).where(Setting.key == body.key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = body.value
        setting.updated_by = user.id
    else:
        db.add(Setting(key=body.key, value=body.value, updated_by=user.id))
    await db.commit()
    return {"message": f"Setting {body.key} updated"}
