"""Fetch tele call leads from 5 TL Google Sheets and sync to DB."""
import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from ..models.models import TeleCallLead
from .google_sheets import _get_service, _read

logger = logging.getLogger(__name__)

# 5 TL lead sheets — all have identical column structure:
# Lead Source | Created Time | Full Name | Phone number | Email |
# Person Calling | Status | Call date | Appointment Date | Remarks | Sale Amount | Product
TELE_CALL_SHEETS = [
    {"spreadsheet_id": "1TRA3RXhnXwIsvduSVJddsDprKcmmkUh6zuSrPQMsvAo", "tl_name": "Kerala"},
    {"spreadsheet_id": "1Or2WJUUn_rsb3MKfRE83UJZYgQDiMA-CDvMJLtFCN10", "tl_name": "Guwahati"},
    {"spreadsheet_id": "1SE8tGQgtEDz5Wo3jb1U9fsXzujD3GdKwYy01gRV2rQU", "tl_name": "Bangalore"},
    {"spreadsheet_id": "1jR035-uTOEcshHGM4BBOFyMdPWhbGNlq9o19x3PhFlI", "tl_name": "Delhi"},
    {"spreadsheet_id": "1viO0nNPq-SDJXB29xM32AULi4qoK7PFKMQe4pW3HD4A", "tl_name": "Chennai"},
]

COL_MAP = {
    0: "lead_source",
    1: "created_time",
    2: "full_name",
    3: "phone",
    4: "email",
    5: "person_calling",
    6: "status",
    7: "call_date",
    8: "appointment_date",
    9: "remarks",
    10: "sale_amount",
    11: "product",
}


def _fetch_sheet_rows(spreadsheet_id: str) -> list[dict]:
    """Fetch all rows from a single TL lead sheet."""
    service = _get_service()
    try:
        rows = _read(service, spreadsheet_id, "Sheet1!A1:L5000")
    except Exception as e:
        logger.warning(f"Default tab read failed for {spreadsheet_id}, trying first visible tab: {e}")
        # Some sheets may have different tab names — try first visible tab
        meta = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        sheets = meta.get("sheets", [])
        if not sheets:
            return []
        tab_name = sheets[0]["properties"]["title"]
        rows = _read(service, spreadsheet_id, f"{tab_name}!A1:L5000")

    if len(rows) < 2:
        return []

    leads = []
    for row in rows[1:]:
        if not row or not any(cell.strip() for cell in row if cell):
            continue
        record = {}
        for col_idx, field in COL_MAP.items():
            record[field] = row[col_idx].strip() if col_idx < len(row) and row[col_idx] else ""
        # Skip rows with no name at all
        if not record.get("full_name"):
            continue
        leads.append(record)
    return leads


async def sync_tele_call_leads(db: AsyncSession) -> dict:
    """Fetch all 5 TL sheets and upsert leads into DB. Returns summary."""
    total_synced = 0

    for sheet_cfg in TELE_CALL_SHEETS:
        spreadsheet_id = sheet_cfg["spreadsheet_id"]
        tl_name = sheet_cfg["tl_name"]

        try:
            leads = await asyncio.to_thread(_fetch_sheet_rows, spreadsheet_id)
        except Exception as e:
            logger.error(f"Failed to fetch tele sheet for {tl_name}: {e}")
            continue

        synced = 0
        for lead_data in leads:
            # Use full_name + phone + spreadsheet as unique key
            phone = lead_data.get("phone", "")
            full_name = lead_data.get("full_name", "")
            created_time = lead_data.get("created_time", "")

            result = await db.execute(
                select(TeleCallLead).where(
                    and_(
                        TeleCallLead.spreadsheet_id == spreadsheet_id,
                        TeleCallLead.full_name == full_name,
                        TeleCallLead.phone == phone,
                        TeleCallLead.created_time == created_time,
                    )
                )
            )
            existing = result.scalar_one_or_none()

            fields = {
                "sheet_tl_name": tl_name,
                "person_calling": lead_data.get("person_calling", ""),
                "lead_source": lead_data.get("lead_source", ""),
                "status": lead_data.get("status", ""),
                "call_date": lead_data.get("call_date", ""),
                "appointment_date": lead_data.get("appointment_date", ""),
                "remarks": lead_data.get("remarks", ""),
                "sale_amount": lead_data.get("sale_amount", ""),
                "product": lead_data.get("product", ""),
                "last_synced_at": datetime.now(timezone.utc),
            }

            if existing:
                if existing.edited_by_user:
                    # Only update non-user fields — protect manual edits
                    existing.lead_source = fields["lead_source"]
                    existing.product = fields["product"]
                    existing.sale_amount = fields["sale_amount"]
                    existing.last_synced_at = fields["last_synced_at"]
                else:
                    for k, v in fields.items():
                        setattr(existing, k, v)
            else:
                new_lead = TeleCallLead(
                    spreadsheet_id=spreadsheet_id,
                    full_name=full_name,
                    phone=phone,
                    email=lead_data.get("email", ""),
                    created_time=created_time,
                    **fields,
                )
                db.add(new_lead)
            synced += 1

        await db.commit()
        total_synced += synced
        logger.info(f"Synced tele leads for {tl_name}: {synced} rows")

    try:
        from ..socket import sio
        await sio.emit("data:refresh", {"section": "tele_call_leads"})
    except Exception as e:
        logger.warning(f"Failed to emit socket refresh: {e}")

    return {"status": "ok", "rows_synced": total_synced}


async def fetch_tele_leads_direct() -> dict:
    """Fetch all 5 TL sheets directly (no DB) — for live view."""
    all_leads = []
    for sheet_cfg in TELE_CALL_SHEETS:
        try:
            leads = await asyncio.to_thread(
                _fetch_sheet_rows, sheet_cfg["spreadsheet_id"]
            )
            for lead in leads:
                lead["sheet_tl_name"] = sheet_cfg["tl_name"]
                lead["spreadsheet_id"] = sheet_cfg["spreadsheet_id"]
            all_leads.extend(leads)
        except Exception as e:
            logger.error(f"Direct fetch failed for {sheet_cfg['tl_name']}: {e}")
    return {"leads": all_leads, "total": len(all_leads)}
