from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ...core.deps import get_db, require_permission
from ...models.models import SheetSource, SheetSyncLog, User
from ...schemas import SheetSourceCreate, SheetSourceUpdate, SheetSourceResponse

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/sources", response_model=list[SheetSourceResponse])
async def list_sources(
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("sheet_sync", "view"),
):
    result = await db.execute(select(SheetSource).order_by(SheetSource.label))
    sources = result.scalars().all()
    out = []
    for s in sources:
        last_log = await db.execute(
            select(SheetSyncLog)
            .where(SheetSyncLog.sheet_source_id == s.id)
            .order_by(SheetSyncLog.created_at.desc())
            .limit(1)
        )
        log = last_log.scalar_one_or_none()
        out.append(SheetSourceResponse(
            id=s.id, label=s.label, spreadsheet_id=s.spreadsheet_id,
            is_xlsx_upload=s.is_xlsx_upload,
            sync_interval_minutes=s.sync_interval_minutes,
            is_enabled=s.is_enabled, tab_mappings=s.tab_mappings or {},
            last_synced_at=log.last_synced_at if log else None,
            last_sync_status=log.status if log else "",
            created_at=s.created_at,
        ))
    return out


@router.post("/sources", response_model=SheetSourceResponse, status_code=201)
async def create_source(
    body: SheetSourceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = require_permission("sheet_sync", "create"),
):
    src = SheetSource(
        label=body.label, spreadsheet_id=body.spreadsheet_id,
        is_xlsx_upload=body.is_xlsx_upload,
        sync_interval_minutes=body.sync_interval_minutes,
        is_enabled=body.is_enabled, tab_mappings=body.tab_mappings,
        created_by=user.id,
    )
    db.add(src)
    await db.commit()
    await db.refresh(src)
    return SheetSourceResponse(
        id=src.id, label=src.label, spreadsheet_id=src.spreadsheet_id,
        is_xlsx_upload=src.is_xlsx_upload,
        sync_interval_minutes=src.sync_interval_minutes,
        is_enabled=src.is_enabled, tab_mappings=src.tab_mappings or {},
        created_at=src.created_at,
    )


@router.put("/sources/{source_id}", response_model=SheetSourceResponse)
async def update_source(
    source_id: int, body: SheetSourceUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("sheet_sync", "edit"),
):
    result = await db.execute(select(SheetSource).where(SheetSource.id == source_id))
    src = result.scalar_one_or_none()
    if not src:
        raise HTTPException(status_code=404, detail="Sheet source not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(src, field, value)
    await db.commit()
    await db.refresh(src)
    return SheetSourceResponse(
        id=src.id, label=src.label, spreadsheet_id=src.spreadsheet_id,
        is_xlsx_upload=src.is_xlsx_upload,
        sync_interval_minutes=src.sync_interval_minutes,
        is_enabled=src.is_enabled, tab_mappings=src.tab_mappings or {},
        created_at=src.created_at,
    )


@router.delete("/sources/{source_id}")
async def delete_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("sheet_sync", "delete"),
):
    result = await db.execute(select(SheetSource).where(SheetSource.id == source_id))
    src = result.scalar_one_or_none()
    if not src:
        raise HTTPException(status_code=404, detail="Sheet source not found")
    await db.delete(src)
    await db.commit()
    return {"message": "Sheet source deleted"}


@router.post("/manual/{source_id}")
async def manual_sync(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    _user: User = require_permission("sheet_sync", "edit"),
):
    from ...services.sheet_sync_service import SheetSyncService
    svc = SheetSyncService()
    result = await svc.sync_source(db, source_id)
    return result
