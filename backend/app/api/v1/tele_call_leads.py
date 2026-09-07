"""Tele Call Leads API — role-based access, edit, assign, sync."""
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from ...db.session import get_db
from ...models.models import TeleCallLead, TeleSheetAssignment, User, Role
from ...services.tele_call_sync import sync_tele_call_leads, fetch_tele_leads_direct, TELE_CALL_SHEETS
from ...core.deps import get_current_user

router = APIRouter(prefix="/tele-call-leads", tags=["Tele Call Leads"])

ADMIN_ROLES = {"SuperAdmin", "Admin", "CEO", "COO", "Regional Manager"}


class LeadUpdate(BaseModel):
    status: Optional[str] = None
    person_calling: Optional[str] = None
    remarks: Optional[str] = None
    salesperson: Optional[str] = None
    call_date: Optional[str] = None
    appointment_date: Optional[str] = None
    product: Optional[str] = None
    sale_amount: Optional[str] = None


class AssignRequest(BaseModel):
    salesperson: str


class SheetAssignmentRequest(BaseModel):
    user_id: int
    sheet_tl_name: str


async def _get_user_sheet_names(db: AsyncSession, user) -> list[str]:
    result = await db.execute(
        select(TeleSheetAssignment.sheet_tl_name).where(
            TeleSheetAssignment.user_id == user.id
        )
    )
    return [row[0] for row in result.all()]


async def _get_user_role_name(db: AsyncSession, user) -> str:
    result = await db.execute(select(Role.name).where(Role.id == user.role_id))
    row = result.scalar_one_or_none()
    return row or ""


async def _check_lead_access(db: AsyncSession, user, lead: TeleCallLead, role_name: str) -> bool:
    if role_name in ADMIN_ROLES:
        return True
    if role_name in ("Team Leader", "Telecaller"):
        sheets = await _get_user_sheet_names(db, user)
        return lead.sheet_tl_name in sheets
    if role_name == "Salesperson":
        return lead.salesperson == user.name
    return False


def _lead_to_dict(lead: TeleCallLead) -> dict:
    return {
        "id": lead.id,
        "lead_source": lead.lead_source,
        "created_time": lead.created_time,
        "full_name": lead.full_name,
        "phone": lead.phone,
        "email": lead.email,
        "person_calling": lead.person_calling,
        "status": lead.status,
        "call_date": lead.call_date,
        "appointment_date": lead.appointment_date,
        "remarks": lead.remarks,
        "sale_amount": lead.sale_amount,
        "product": lead.product,
        "salesperson": lead.salesperson,
        "sheet_tl_name": lead.sheet_tl_name,
    }


# ── Static routes FIRST (before /{lead_id}) ────────────────────────

@router.get("")
async def get_tele_call_leads(
    tl_name: str = Query("", description="Filter by city sheet name"),
    status: str = Query("", description="Filter by status"),
    person_calling: str = Query("", description="Filter by person calling"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get tele call leads — role-based filtering applied automatically."""
    role_name = await _get_user_role_name(db, user)

    query = select(TeleCallLead)

    if role_name in ADMIN_ROLES:
        pass
    elif role_name in ("Team Leader", "Telecaller"):
        sheets = await _get_user_sheet_names(db, user)
        if not sheets:
            return {"tl_groups": {}, "total": 0, "role": role_name, "user_sheets": []}
        query = query.where(TeleCallLead.sheet_tl_name.in_(sheets))
    elif role_name == "Salesperson":
        query = query.where(TeleCallLead.salesperson == user.name)
    else:
        return {"tl_groups": {}, "total": 0, "role": role_name, "user_sheets": []}

    if tl_name:
        query = query.where(TeleCallLead.sheet_tl_name == tl_name)
    if status:
        query = query.where(TeleCallLead.status == status)
    if person_calling:
        query = query.where(TeleCallLead.person_calling == person_calling)

    query = query.order_by(TeleCallLead.sheet_tl_name, TeleCallLead.created_time.desc())
    result = await db.execute(query)
    leads = result.scalars().all()

    tl_groups: dict[str, list] = {}
    for lead in leads:
        tl = lead.sheet_tl_name or "Unknown"
        if tl not in tl_groups:
            tl_groups[tl] = []
        tl_groups[tl].append(_lead_to_dict(lead))

    summary = {}
    for tl, tl_leads in tl_groups.items():
        status_counts: dict[str, int] = {}
        for l in tl_leads:
            s = l["status"] or "No Status"
            status_counts[s] = status_counts.get(s, 0) + 1
        summary[tl] = {
            "total": len(tl_leads),
            "status_counts": status_counts,
            "leads": tl_leads,
        }

    return {"tl_groups": summary, "total": len(leads), "role": role_name}


@router.get("/my-sheets")
async def get_my_sheets(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get the city sheets assigned to the current user."""
    sheets = await _get_user_sheet_names(db, user)
    return {"sheets": sheets}


@router.get("/salespersons")
async def get_salespersons(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """List all salesperson users (for assignment dropdown)."""
    result = await db.execute(
        select(User).join(Role).where(Role.name == "Salesperson")
    )
    users = result.scalars().all()
    return {"salespersons": [{"id": u.id, "name": u.name, "email": u.email} for u in users]}


@router.get("/telecallers")
async def get_telecallers_for_my_sheets(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List telecallers assigned to the same city sheets as the current user."""
    my_sheets = await _get_user_sheet_names(db, user)
    if not my_sheets:
        return {"telecallers": []}

    result = await db.execute(
        select(User.id, User.name, User.email, TeleSheetAssignment.sheet_tl_name)
        .join(TeleSheetAssignment, TeleSheetAssignment.user_id == User.id)
        .join(Role, Role.id == User.role_id)
        .where(
            Role.name == "Telecaller",
            TeleSheetAssignment.sheet_tl_name.in_(my_sheets),
        )
        .distinct()
    )
    rows = result.all()
    telecallers = [{"id": r[0], "name": r[1], "email": r[2], "sheet": r[3]} for r in rows]
    return {"telecallers": telecallers}


@router.get("/status-summary")
async def get_status_summary(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get status summary — role-based filtering applied."""
    role_name = await _get_user_role_name(db, user)

    query = select(
        TeleCallLead.sheet_tl_name,
        TeleCallLead.status,
        func.count(TeleCallLead.id),
    )

    if role_name in ("Team Leader", "Telecaller"):
        sheets = await _get_user_sheet_names(db, user)
        if sheets:
            query = query.where(TeleCallLead.sheet_tl_name.in_(sheets))
        else:
            return {"summary": {}}
    elif role_name == "Salesperson":
        query = query.where(TeleCallLead.salesperson == user.name)

    query = query.group_by(TeleCallLead.sheet_tl_name, TeleCallLead.status)
    rows = await db.execute(query)

    summary: dict[str, dict] = {}
    for tl_name, status, count in rows.all():
        tl = tl_name or "Unknown"
        if tl not in summary:
            summary[tl] = {"total": 0, "statuses": {}}
        summary[tl]["total"] += count
        summary[tl]["statuses"][status or "No Status"] = count

    return {"summary": summary}


@router.post("/sync")
async def sync_tele_call(
    db: AsyncSession = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Trigger a manual sync of all 5 city lead sheets."""
    result = await sync_tele_call_leads(db)
    return result


@router.get("/live")
async def get_tele_leads_live(
    _user=Depends(get_current_user),
):
    """Fetch tele call leads directly from Google Sheets (no DB, live)."""
    return await fetch_tele_leads_direct()


@router.get("/sheets")
async def get_tele_sheet_config(
    _user=Depends(get_current_user),
):
    """Return the list of city sheet configurations."""
    return {"sheets": TELE_CALL_SHEETS}


@router.post("/sheet-assignments")
async def create_sheet_assignment(
    body: SheetAssignmentRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create a user→sheet assignment. Admin only."""
    role_name = await _get_user_role_name(db, user)
    if role_name not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin only")

    result = await db.execute(select(User).where(User.id == body.user_id))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    valid_sheets = {s["tl_name"] for s in TELE_CALL_SHEETS}
    if body.sheet_tl_name not in valid_sheets:
        raise HTTPException(status_code=400, detail=f"Invalid sheet name. Valid: {valid_sheets}")

    result = await db.execute(
        select(TeleSheetAssignment).where(
            and_(
                TeleSheetAssignment.user_id == body.user_id,
                TeleSheetAssignment.sheet_tl_name == body.sheet_tl_name,
            )
        )
    )
    if result.scalar_one_or_none():
        return {"ok": True, "message": "Already assigned"}

    assignment = TeleSheetAssignment(
        user_id=body.user_id,
        sheet_tl_name=body.sheet_tl_name,
    )
    db.add(assignment)
    await db.commit()

    return {"ok": True, "message": f"Assigned {target_user.name} to {body.sheet_tl_name}"}


# ── Dynamic routes LAST (after all static paths) ───────────────────

@router.put("/{lead_id}")
async def update_lead(
    lead_id: int,
    body: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update a tele call lead. Role-based access enforced."""
    role_name = await _get_user_role_name(db, user)

    result = await db.execute(select(TeleCallLead).where(TeleCallLead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if not await _check_lead_access(db, user, lead, role_name):
        raise HTTPException(status_code=403, detail="Access denied to this lead")

    if body.status is not None:
        lead.status = body.status
    if body.person_calling is not None:
        lead.person_calling = body.person_calling
    if body.remarks is not None:
        lead.remarks = body.remarks
    if body.call_date is not None:
        lead.call_date = body.call_date
    if body.appointment_date is not None:
        lead.appointment_date = body.appointment_date
    if body.product is not None:
        lead.product = body.product
    if body.sale_amount is not None:
        lead.sale_amount = body.sale_amount

    if body.salesperson is not None and role_name in ("Team Leader",) + tuple(ADMIN_ROLES):
        lead.salesperson = body.salesperson

    lead.edited_by_user = True
    await db.commit()

    return {
        "ok": True,
        "lead": {
            "id": lead.id,
            "status": lead.status,
            "person_calling": lead.person_calling,
            "remarks": lead.remarks,
            "salesperson": lead.salesperson,
            "call_date": lead.call_date,
            "appointment_date": lead.appointment_date,
            "edited_by_user": lead.edited_by_user,
        },
    }


@router.post("/{lead_id}/assign")
async def assign_lead(
    lead_id: int,
    body: AssignRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Assign a lead to a salesperson. TL and Admin only."""
    role_name = await _get_user_role_name(db, user)

    if role_name not in ("Team Leader",) + tuple(ADMIN_ROLES):
        raise HTTPException(status_code=403, detail="Only Team Leaders can assign leads")

    result = await db.execute(select(TeleCallLead).where(TeleCallLead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if role_name == "Team Leader":
        sheets = await _get_user_sheet_names(db, user)
        if lead.sheet_tl_name not in sheets:
            raise HTTPException(status_code=403, detail="Access denied to this lead")

    lead.salesperson = body.salesperson
    lead.edited_by_user = True
    await db.commit()

    return {"ok": True, "salesperson": lead.salesperson}
