from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ...core.deps import get_db, require_permission
from ...models.models import Role, Permission, RolePermission, User
from ...schemas import (
    RoleCreate, RoleUpdate, RoleResponse, PermissionResponse,
    RolePermissionUpdate,
)

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("/", response_model=list[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("roles", "view"),
):
    result = await db.execute(select(Role).order_by(Role.name))
    return [RoleResponse.model_validate(r) for r in result.scalars().all()]


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    body: RoleCreate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("roles", "create"),
):
    existing = await db.execute(select(Role).where(Role.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role name already exists")
    role = Role(name=body.name, description=body.description)
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return RoleResponse.model_validate(role)


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("roles", "view"),
):
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return RoleResponse.model_validate(role)


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    body: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("roles", "edit"),
):
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(role, field, value)
    await db.commit()
    await db.refresh(role)
    return RoleResponse.model_validate(role)


@router.delete("/{role_id}")
async def delete_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("roles", "delete"),
):
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    await db.delete(role)
    await db.commit()
    return {"message": "Role deleted"}


@router.get("/permissions/all", response_model=list[PermissionResponse])
async def list_all_permissions(
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("roles", "view"),
):
    result = await db.execute(select(Permission).order_by(Permission.resource, Permission.action))
    return [PermissionResponse.model_validate(p) for p in result.scalars().all()]


@router.get("/{role_id}/permissions", response_model=list[PermissionResponse])
async def get_role_permissions(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("roles", "view"),
):
    result = await db.execute(
        select(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == role_id)
        .order_by(Permission.resource, Permission.action)
    )
    return [PermissionResponse.model_validate(p) for p in result.scalars().all()]


@router.put("/{role_id}/permissions")
async def update_role_permissions(
    role_id: int,
    body: RolePermissionUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("roles", "edit"),
):
    role = await db.execute(select(Role).where(Role.id == role_id))
    if not role.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Role not found")

    await db.execute(
        RolePermission.__table__.delete().where(RolePermission.role_id == role_id)
    )
    for pid in body.permission_ids:
        db.add(RolePermission(role_id=role_id, permission_id=pid))
    await db.commit()
    return {"message": f"Permissions updated for role {role_id}"}
