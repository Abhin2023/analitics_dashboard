from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ...core.deps import get_db, require_permission
from ...core.security import hash_password
from ...models.models import User, Role, UserStoreAccess
from ...schemas import UserCreate, UserUpdate, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("users", "view"),
):
    result = await db.execute(select(User).order_by(User.name))
    users = result.scalars().all()
    role_cache = {}
    out = []
    for u in users:
        if u.role_id not in role_cache:
            r = await db.execute(select(Role).where(Role.id == u.role_id))
            role_cache[u.role_id] = r.scalar_one_or_none()
        rl = role_cache.get(u.role_id)
        store_ids = [sa.store_id for sa in u.store_access]
        out.append(UserResponse(
            id=u.id, name=u.name, email=u.email, role_id=u.role_id,
            role_name=rl.name if rl else "", is_active=u.is_active,
            store_ids=store_ids, created_at=u.created_at,
        ))
    return out


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("users", "create"),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role_id=body.role_id,
        is_active=body.is_active,
    )
    db.add(user)
    await db.flush()

    for sid in body.store_ids:
        db.add(UserStoreAccess(user_id=user.id, store_id=sid))
    await db.commit()
    await db.refresh(user)

    r = await db.execute(select(Role).where(Role.id == user.role_id))
    rl = r.scalar_one_or_none()
    return UserResponse(
        id=user.id, name=user.name, email=user.email, role_id=user.role_id,
        role_name=rl.name if rl else "", is_active=user.is_active,
        store_ids=body.store_ids, created_at=user.created_at,
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("users", "view"),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    r = await db.execute(select(Role).where(Role.id == user.role_id))
    rl = r.scalar_one_or_none()
    store_ids = [sa.store_id for sa in user.store_access]
    return UserResponse(
        id=user.id, name=user.name, email=user.email, role_id=user.role_id,
        role_name=rl.name if rl else "", is_active=user.is_active,
        store_ids=store_ids, created_at=user.created_at,
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("users", "edit"),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in body.model_dump(exclude_unset=True, exclude={"store_ids"}).items():
        setattr(user, field, value)

    if body.store_ids is not None:
        await db.execute(
            UserStoreAccess.__table__.delete().where(UserStoreAccess.user_id == user_id)
        )
        for sid in body.store_ids:
            db.add(UserStoreAccess(user_id=user_id, store_id=sid))

    await db.commit()
    await db.refresh(user)
    r = await db.execute(select(Role).where(Role.id == user.role_id))
    rl = r.scalar_one_or_none()
    store_ids = [sa.store_id for sa in user.store_access]
    return UserResponse(
        id=user.id, name=user.name, email=user.email, role_id=user.role_id,
        role_name=rl.name if rl else "", is_active=user.is_active,
        store_ids=store_ids, created_at=user.created_at,
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("users", "delete"),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return {"message": "User deleted"}
