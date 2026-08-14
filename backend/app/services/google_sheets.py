"""Google Sheets live data reader using service account credentials."""
import os
import logging
from typing import Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

# Spreadsheet IDs
SHEET_OPERATIONS = "1lZCsuNceb_FsePEFtPg4X-rs9pk4JJKjSsV_ZN65w60"
SHEET_DASHBOARD = "1w893ChKglcqIxHnoDqJ6DfOEmQG51VGJqiEy5lg-yEA"


def _get_service():
    """Build Google Sheets API service using service account."""
    sa_path = os.environ.get(
        "GOOGLE_SERVICE_ACCOUNT_JSON",
        os.path.join(os.path.dirname(__file__), "..", "..", "bp-analytics-sync-75ca3b0a13a4.json"),
    )
    if not os.path.exists(sa_path):
        raise FileNotFoundError(f"Service account JSON not found: {sa_path}")
    creds = service_account.Credentials.from_service_account_file(sa_path, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)


def _read(service, spreadsheet_id: str, tab_range: str) -> list[list[str]]:
    """Read a range from a spreadsheet. Returns list of rows (each row is a list of cell values)."""
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range=tab_range
    ).execute()
    return result.get("values", [])


def _num(val) -> Optional[float]:
    """Parse a numeric value, handling commas and currency symbols."""
    if val is None:
        return None
    s = str(val).strip().replace(",", "").replace("₹", "").replace("AED", "").replace("OMR", "").replace("%", "").replace("—", "").replace("-", "")
    if not s or s == "" or s.lower() in ("n/a", "—", "-"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _int_val(val) -> Optional[int]:
    n = _num(val)
    return int(n) if n is not None else None


def fetch_ops_data() -> list[dict]:
    """Fetch daily operations data from Master Log tab."""
    service = _get_service()
    rows = _read(service, SHEET_OPERATIONS, "Master Log!A1:Z5000")
    if len(rows) < 2:
        return []

    headers = [h.strip().lower().replace(" ", "_") for h in rows[0]]
    data = []
    for row in rows[1:]:
        if len(row) < 6:
            continue
        record = {}
        for i, h in enumerate(headers):
            record[h] = row[i] if i < len(row) else ""
        data.append({
            "date": record.get("date", ""),
            "tl": record.get("tl_name", record.get("tl", "")),
            "store": record.get("store_name", record.get("store", "")),
            "country": record.get("country", "India"),
            "revenue": _num(record.get("revenue", 0)),
            "monthly_target": _num(record.get("monthly_target", 0)),
            "units_sold": _int_val(record.get("units_sold", 0)),
            "new_leads": _int_val(record.get("new_leads", 0)),
            "active_leads": _int_val(record.get("active_leads", 0)),
            "calls_made": _int_val(record.get("calls_made", 0)),
            "calls_connected": _int_val(record.get("calls_connected", 0)),
            "walk_ins": _int_val(record.get("walk-ins", record.get("walk_ins", 0))),
            "walk_in_conversions": _int_val(record.get("walk-in_conversions", record.get("walk_in_conversions", 0))),
            "care_attached": _int_val(record.get("care+_attached", record.get("care_attached", 0))),
        })
    return data


def fetch_store_config() -> list[dict]:
    """Fetch store configuration from Config tab."""
    service = _get_service()
    rows = _read(service, SHEET_OPERATIONS, "Config!A9:J200")
    if len(rows) < 2:
        return []

    # Skip the header row (row 0 is instructions)
    data = []
    for row in rows[1:]:
        if len(row) < 9 or not row[0].strip() or row[0].startswith("←") or row[0].startswith("Add row"):
            continue
        data.append({
            "tl": row[0].strip(),
            "store": row[1].strip(),
            "country": row[2].strip() if len(row) > 2 else "India",
            "monthly_target": _num(row[3]),
            "breakeven_rev": _num(row[4]) if len(row) > 4 else None,
            "profitability_target": _num(row[5]) if len(row) > 5 else None,
            "fixed_costs": _num(row[6]) if len(row) > 6 else None,
            "variable_cost_pct": row[7].strip() if len(row) > 7 else None,
            "active": row[8].strip().upper() == "Y" if len(row) > 8 else True,
        })
    return data


def fetch_store_config_v2() -> list[dict]:
    """Fetch store manager/target config from STORE CONFIG tab in Dashboard sheet."""
    service = _get_service()
    rows = _read(service, SHEET_DASHBOARD, "🏪 STORE CONFIG!A4:F100")
    if len(rows) < 1:
        return []
    data = []
    for row in rows:
        if len(row) < 5 or not row[0].strip():
            continue
        data.append({
            "store": row[0].strip(),
            "manager": row[1].strip() if len(row) > 1 else "",
            "daily_target": _num(row[4]) if len(row) > 4 else None,
            "monthly_target": _num(row[5]) if len(row) > 5 else None,
        })
    return data


def fetch_osmc_staff() -> list[dict]:
    """Fetch India store manpower from OSMC tab."""
    service = _get_service()
    rows = _read(service, SHEET_DASHBOARD, "OSMC!A3:L50")
    data = []
    for row in rows:
        if len(row) < 8 or not row[1].strip():
            continue
        store = row[1].strip()
        if store.startswith("ORGANIZATION"):
            continue
        data.append({
            "store": store,
            "manager": row[2].strip() if len(row) > 2 else "",
            "has_accommodation": row[3].strip().upper() == "YES" if len(row) > 3 else False,
            "staff_count": _int_val(row[7]) if len(row) > 7 else 0,
            "resource_required": _int_val(row[8]) if len(row) > 8 else 0,
            "training": row[9].strip().upper() == "YES" if len(row) > 9 else False,
            "notes": row[10].strip() if len(row) > 10 else "",
            "tl": row[11].strip() if len(row) > 11 else "",
        })
    return data


def fetch_intl_staff() -> list[dict]:
    """Fetch international store manpower from OSMC Intl tab."""
    service = _get_service()
    rows = _read(service, SHEET_DASHBOARD, "OSMC Intl!A3:L50")
    data = []
    for row in rows:
        if len(row) < 8 or not row[0].strip():
            continue
        store = row[0].strip()
        if store.startswith("ORGANIZATION"):
            continue
        data.append({
            "store": store,
            "sales": row[1].strip() if len(row) > 1 else "",
            "total": _int_val(row[3]) if len(row) > 3 else 0,
            "resource_required": _int_val(row[4]) if len(row) > 4 else 0,
            "training": row[5].strip().upper() == "YES" if len(row) > 5 else False,
            "notes": row[6].strip() if len(row) > 6 else "",
            "tl": row[7].strip() if len(row) > 7 else "",
            "target": _num(row[11]) if len(row) > 11 else None,
        })
    return data


def fetch_google_reviews() -> list[dict]:
    """Fetch Google Reviews data from Google Reviews tab."""
    service = _get_service()
    rows = _read(service, SHEET_DASHBOARD, "Google Reviews!A1:L50")
    if len(rows) < 2:
        return []
    data = []
    for row in rows[1:]:
        if len(row) < 6 or not row[2].strip():
            continue
        data.append({
            "store": row[2].strip(),
            "rating": _num(row[3]) if len(row) > 3 else None,
            "total_reviews": _int_val(row[4]) if len(row) > 4 else None,
            "current_rating": _num(row[5]) if len(row) > 5 else None,
            "current_total_reviews": _int_val(row[6]) if len(row) > 6 else None,
            "new_reviews": _int_val(row[7]) if len(row) > 7 else 0,
        })
    return data


def fetch_gr_action_plan() -> list[dict]:
    """Fetch Google Review action plans from GR Action Plan tab."""
    service = _get_service()
    rows = _read(service, SHEET_DASHBOARD, "GR Action Plan!A3:J50")
    data = []
    for row in rows:
        if len(row) < 8 or not row[0].strip():
            continue
        data.append({
            "store": row[0].strip(),
            "tier": row[1].strip() if len(row) > 1 else "",
            "current_rating": row[2].strip() if len(row) > 2 else "",
            "current_reviews": _int_val(row[3]) if len(row) > 3 else None,
            "reviews_needed": _int_val(row[4]) if len(row) > 4 else None,
            "weekly_target": row[5].strip() if len(row) > 5 else "",
            "timeline": row[6].strip() if len(row) > 6 else "",
            "root_cause": row[7].strip() if len(row) > 7 else "",
            "actions": row[8].strip() if len(row) > 8 else "",
            "checklist": row[9].strip() if len(row) > 9 else "",
        })
    return data


def fetch_tl_report() -> list[dict]:
    """Fetch TL-wise report from TL Report tab."""
    service = _get_service()
    rows = _read(service, SHEET_DASHBOARD, "TL Report!A1:M100")
    if len(rows) < 2:
        return []
    data = []
    current_tl = ""
    for row in rows[1:]:
        if len(row) < 2:
            continue
        # TL names appear as standalone rows
        if row[0].strip() and not row[0].strip().startswith("Hyderabad") and not row[0].strip().startswith("Kerala") and not row[0].strip().startswith("Chennai") and not row[0].strip().startswith("Delhi") and not row[0].strip().startswith("Mumbai") and not row[0].strip().startswith("Guwahati") and not row[0].strip().startswith("Bangalore") and not row[0].strip().startswith("Mangalore") and not row[0].strip().startswith("Mysore") and not row[0].strip().startswith("TN"):
            if row[0].strip().upper() in ("MICHAEL", "SAM", "NAZIL", "ABDULLAH", "HARSH", "DEVIAHH"):
                current_tl = row[0].strip().upper()
            continue
        if len(row) < 8:
            continue
        data.append({
            "tl": current_tl,
            "store": row[0].strip(),
            "target": _num(row[1]) if len(row) > 1 else None,
            "achieved": _num(row[2]) if len(row) > 2 else None,
            "ach_pct": row[3].strip() if len(row) > 3 else "0%",
            "walkins": _int_val(row[6]) if len(row) > 6 else None,
            "conversions": _int_val(row[7]) if len(row) > 7 else None,
            "conv_pct": row[8].strip() if len(row) > 8 else "0%",
            "leads_received": _int_val(row[9]) if len(row) > 9 else None,
            "leads_converted": _int_val(row[10]) if len(row) > 10 else None,
        })
    return data


def fetch_all_sheet_data() -> dict:
    """Fetch all CEO dashboard data from Google Sheets."""
    try:
        return {
            "ops_data": fetch_ops_data(),
            "store_config": fetch_store_config(),
            "store_config_v2": fetch_store_config_v2(),
            "staff": fetch_osmc_staff(),
            "intl_staff": fetch_intl_staff(),
            "reviews": fetch_google_reviews(),
            "gr_action_plan": fetch_gr_action_plan(),
            "tl_report": fetch_tl_report(),
        }
    except Exception as e:
        logger.error(f"Failed to fetch sheet data: {e}")
        return {"error": str(e)}
