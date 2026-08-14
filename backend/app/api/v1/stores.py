from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ...core.deps import get_db, require_permission, get_user_permissions
from ...models.models import Store, User, UserStoreAccess
from ...schemas import StoreCreate, StoreUpdate, StoreResponse

router = APIRouter(prefix="/stores", tags=["stores"])


@router.get("/", response_model=list[StoreResponse])
async def list_stores(
    db: AsyncSession = Depends(get_db),
    user: User = require_permission("team_leaders", "view"),
):
    perms = await get_user_permissions(user, db)
    has_full = any(p["resource"] == "team_leaders" and p["action"] == "view" for p in perms)

    if has_full and not user.store_access:
        result = await db.execute(select(Store).order_by(Store.name))
    else:
        store_ids = [sa.store_id for sa in user.store_access]
        if not store_ids:
            return []
        result = await db.execute(
            select(Store).where(Store.id.in_(store_ids)).order_by(Store.name)
        )

    stores = result.scalars().all()
    tl_cache = {}
    out = []
    for s in stores:
        if s.team_leader_id not in tl_cache:
            r = await db.execute(select(User).where(User.id == s.team_leader_id))
            tl_cache[s.team_leader_id] = r.scalar_one_or_none()
        tl = tl_cache.get(s.team_leader_id)
        out.append(StoreResponse(
            id=s.id, name=s.name, team_leader_id=s.team_leader_id,
            team_leader_name=tl.name if tl else "",
            currency_code=s.currency_code,
            daily_target=float(s.daily_target),
            monthly_target=float(s.monthly_target),
            breakeven_revenue=float(s.breakeven_revenue),
            profitability_target=float(s.profitability_target),
            fixed_costs=float(s.fixed_costs),
            variable_cost_pct=float(s.variable_cost_pct),
            is_active=s.is_active, region=s.region or "",
            created_at=s.created_at,
        ))
    return out


@router.post("/", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
async def create_store(
    body: StoreCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("team_leaders", "create"),
):
    store = Store(
        name=body.name, team_leader_id=body.team_leader_id,
        currency_code=body.currency_code,
        daily_target=body.daily_target, monthly_target=body.monthly_target,
        breakeven_revenue=body.breakeven_revenue,
        profitability_target=body.profitability_target,
        fixed_costs=body.fixed_costs, variable_cost_pct=body.variable_cost_pct,
        is_active=body.is_active, region=body.region,
    )
    db.add(store)
    await db.commit()
    await db.refresh(store)
    r = await db.execute(select(User).where(User.id == store.team_leader_id))
    tl = r.scalar_one_or_none()
    return StoreResponse(
        id=store.id, name=store.name, team_leader_id=store.team_leader_id,
        team_leader_name=tl.name if tl else "",
        currency_code=store.currency_code,
        daily_target=float(store.daily_target),
        monthly_target=float(store.monthly_target),
        breakeven_revenue=float(store.breakeven_revenue),
        profitability_target=float(store.profitability_target),
        fixed_costs=float(store.fixed_costs),
        variable_cost_pct=float(store.variable_cost_pct),
        is_active=store.is_active, region=store.region or "",
        created_at=store.created_at,
    )


@router.get("/{store_id}", response_model=StoreResponse)
async def get_store(
    store_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = require_permission("team_leaders", "view"),
):
    result = await db.execute(select(Store).where(Store.id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if user.store_access:
        access_ids = [sa.store_id for sa in user.store_access]
        if store_id not in access_ids:
            raise HTTPException(status_code=403, detail="No access to this store")
    r = await db.execute(select(User).where(User.id == store.team_leader_id))
    tl = r.scalar_one_or_none()
    return StoreResponse(
        id=store.id, name=store.name, team_leader_id=store.team_leader_id,
        team_leader_name=tl.name if tl else "",
        currency_code=store.currency_code,
        daily_target=float(store.daily_target),
        monthly_target=float(store.monthly_target),
        breakeven_revenue=float(store.breakeven_revenue),
        profitability_target=float(store.profitability_target),
        fixed_costs=float(store.fixed_costs),
        variable_cost_pct=float(store.variable_cost_pct),
        is_active=store.is_active, region=store.region or "",
        created_at=store.created_at,
    )


@router.put("/{store_id}", response_model=StoreResponse)
async def update_store(
    store_id: int,
    body: StoreUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("team_leaders", "edit"),
):
    result = await db.execute(select(Store).where(Store.id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(store, field, value)
    await db.commit()
    await db.refresh(store)
    r = await db.execute(select(User).where(User.id == store.team_leader_id))
    tl = r.scalar_one_or_none()
    return StoreResponse(
        id=store.id, name=store.name, team_leader_id=store.team_leader_id,
        team_leader_name=tl.name if tl else "",
        currency_code=store.currency_code,
        daily_target=float(store.daily_target),
        monthly_target=float(store.monthly_target),
        breakeven_revenue=float(store.breakeven_revenue),
        profitability_target=float(store.profitability_target),
        fixed_costs=float(store.fixed_costs),
        variable_cost_pct=float(store.variable_cost_pct),
        is_active=store.is_active, region=store.region or "",
        created_at=store.created_at,
    )


@router.delete("/{store_id}")
async def delete_store(
    store_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("team_leaders", "delete"),
):
    result = await db.execute(select(Store).where(Store.id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    await db.delete(store)
    await db.commit()
    return {"message": "Store deleted"}
