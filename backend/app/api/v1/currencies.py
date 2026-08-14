from datetime import date
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ...core.deps import get_db, require_permission
from ...models.models import Currency, ExchangeRate, User
from ...schemas import CurrencyResponse, ExchangeRateCreate, ExchangeRateResponse

router = APIRouter(prefix="/currencies", tags=["currencies"])


@router.get("/", response_model=list[CurrencyResponse])
async def list_currencies(
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("settings", "view"),
):
    result = await db.execute(select(Currency).order_by(Currency.code))
    return [CurrencyResponse.model_validate(c) for c in result.scalars().all()]


@router.get("/exchange-rates", response_model=list[ExchangeRateResponse])
async def list_exchange_rates(
    currency_code: str = None,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("settings", "view"),
):
    query = select(ExchangeRate)
    if currency_code:
        query = query.where(ExchangeRate.currency_code == currency_code)
    result = await db.execute(query.order_by(ExchangeRate.effective_date.desc()))
    return [ExchangeRateResponse.model_validate(r) for r in result.scalars().all()]


@router.post("/exchange-rates", response_model=ExchangeRateResponse, status_code=status.HTTP_201_CREATED)
async def create_exchange_rate(
    body: ExchangeRateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = require_permission("settings", "create"),
):
    existing = await db.execute(
        select(ExchangeRate).where(
            ExchangeRate.currency_code == body.currency_code,
            ExchangeRate.effective_date == body.effective_date,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Rate already exists for this currency and date")

    rate = ExchangeRate(
        currency_code=body.currency_code, rate_to_base=body.rate_to_base,
        effective_date=body.effective_date, source="manual", created_by=user.id,
    )
    db.add(rate)
    await db.commit()
    await db.refresh(rate)
    return ExchangeRateResponse.model_validate(rate)


@router.delete("/exchange-rates/{rate_id}")
async def delete_exchange_rate(
    rate_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("settings", "delete"),
):
    result = await db.execute(select(ExchangeRate).where(ExchangeRate.id == rate_id))
    rate = result.scalar_one_or_none()
    if not rate:
        raise HTTPException(status_code=404, detail="Exchange rate not found")
    await db.delete(rate)
    await db.commit()
    return {"message": "Exchange rate deleted"}
