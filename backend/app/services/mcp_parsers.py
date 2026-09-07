import re
from typing import Any


def _parse_amount(text: str) -> float:
    """Parse 'AED 181,507.37' or 'INR 537,164.67' to float."""
    match = re.search(r"[\d,]+\.?\d*", text.replace(",", ""))
    return float(match.group()) if match else 0.0


def _parse_int(text: str) -> int:
    match = re.search(r"\d+", text)
    return int(match.group()) if match else 0


def parse_sales_summary(text: str) -> dict[str, Any]:
    """Parse sales_summary MCP response."""
    result = {"transactions": 0, "gross": 0.0, "discount": 0.0, "net": 0.0, "currency": ""}

    lines = [l.strip() for l in text.split("\r\n") if l.strip()]

    for line in lines:
        if line.startswith("Period:"):
            result["period"] = line.split(":", 1)[1].strip()
        elif "Transactions" in line and ":" in line:
            result["transactions"] = _parse_int(line.split(":")[1])
        elif "Gross" in line:
            parts = line.split(":")
            result["currency"] = parts[0].replace("Gross amount", "").strip()
            result["gross"] = _parse_amount(parts[1]) if len(parts) > 1 else 0.0
        elif "Discount" in line and ":" in line:
            result["discount"] = _parse_amount(line.split(":")[1])
        elif "Net" in line and "amount" in line:
            result["net"] = _parse_amount(line.split(":")[1])

    return result


def parse_shop_wise_sales(text: str) -> list[dict[str, Any]]:
    """Parse shop_wise_sales MCP response."""
    shops = []
    current_shop = None

    lines = text.split("\r\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line.startswith("■ "):
            if current_shop:
                shops.append(current_shop)
            current_shop = {
                "shop": line[2:].strip(),
                "total_sales": 0,
                "total_amount": 0.0,
                "categories": {},
                "purchase_types": {},
                "payment_methods": {},
            }
        elif current_shop and line.startswith("Total:"):
            parts = line.split(",")
            current_shop["total_sales"] = _parse_int(parts[0])
            if len(parts) > 1:
                current_shop["total_amount"] = _parse_amount(parts[1])
        elif current_shop and line.startswith("- "):
            # Category, purchase type, or payment line
            inner = line[2:]
            parts = inner.split(":")
            if len(parts) == 2:
                key = parts[0].strip()
                value = _parse_amount(parts[1])
                count_match = re.search(r"^(\d+)", parts[1].strip())
                count = int(count_match.group()) if count_match else 0

                if current_shop["categories"] or "New Sale" in inner or "Replacement" in inner or "Return" in inner or "DeviceDamage" in inner or "Upgrade" in inner:
                    current_shop["categories"][key] = {"count": count, "amount": value}
                elif any(
                    pt in inner
                    for pt in ["Break Protection", "Clear", "BP Authorized", "Accessory"]
                ):
                    current_shop["purchase_types"][key] = {"count": count, "amount": value}
                else:
                    current_shop["payment_methods"][key] = value

    if current_shop:
        shops.append(current_shop)

    return shops


def parse_transaction_detail(text: str) -> list[dict[str, Any]]:
    """Parse transaction_detail MCP response."""
    transactions = []
    current = None

    lines = text.split("\r\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line.startswith("#"):
            if current:
                transactions.append(current)
            parts = line.split("|")
            shop_date = parts[1].strip() if len(parts) > 1 else ""
            category = parts[2].strip() if len(parts) > 2 else ""
            current = {
                "id": _parse_int(parts[0]),
                "date": shop_date,
                "shop": "",
                "category": category,
                "model": "",
                "imei": "",
                "amount": 0.0,
                "discount": 0.0,
                "paid": False,
            }
            # Extract shop name (between date and category)
            if len(parts) > 1:
                date_shop = parts[1].strip()
                date_match = re.match(r"(\d{2}-\w+-\d{4})\s*\|\s*(.*?)$", date_shop)
                if date_match:
                    current["date"] = date_match.group(1)
                    current["shop"] = date_match.group(2).strip()

        elif current and not line.startswith("#"):
            if "IMEI" in line:
                parts = line.split("|")
                model_part = parts[0].strip()
                imei_match = re.search(r"IMEI\s+(\S+)", line)
                current["model"] = model_part.split("|")[0].strip()
                if imei_match:
                    current["imei"] = imei_match.group(1)
            elif "Amount:" in line:
                amount_match = re.search(r"Amount:\s*[\w]*\s*([\d,]+\.?\d*)", line)
                disc_match = re.search(r"disc\s*[\w]*\s*([\d,]+\.?\d*)", line)
                paid_match = re.search(r"Paid:\s*(Yes|No)", line)
                if amount_match:
                    current["amount"] = float(amount_match.group(1).replace(",", ""))
                if disc_match:
                    current["discount"] = float(disc_match.group(1).replace(",", ""))
                if paid_match:
                    current["paid"] = paid_match.group(1) == "Yes"

    if current:
        transactions.append(current)

    return transactions


def parse_shop_target_achievement(text: str) -> list[dict[str, Any]]:
    """Parse shop_target_achievement MCP response."""
    shops = []
    current = None
    in_note_section = False

    lines = text.split("\r\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line.startswith("NOTE"):
            in_note_section = True
            continue

        if line.startswith("■ "):
            in_note_section = False
            if current:
                shops.append(current)
            current = {
                "shop": line[2:].strip(),
                "target": 0.0,
                "actual": 0.0,
                "achievement_pct": 0.0,
                "status": "",
            }
        elif in_note_section and not line.startswith("─") and not line.startswith("Period"):
            match = re.match(r"^(.*?)\s+[A-Z]{3}\s+([\d,]+\.?\d*)\s*\(no target\)", line)
            if match:
                shops.append({
                    "shop": match.group(1).strip(),
                    "target": 0.0,
                    "actual": _parse_amount(match.group(2)),
                    "achievement_pct": 0.0,
                    "status": "no target",
                })
        elif current:
            lower = line.lower()
            if "target" in lower and ":" in line and "no target" not in lower:
                current["target"] = _parse_amount(line.split(":")[1])
            elif "actual" in lower and ":" in line:
                current["actual"] = _parse_amount(line.split(":")[1])
            elif "achievement" in lower and ":" in line:
                pct_match = re.search(r"([\d.]+)%", line)
                if pct_match:
                    current["achievement_pct"] = float(pct_match.group(1))
            elif line.lower().startswith("over") or line.lower().startswith("under"):
                current["status"] = line.strip()

    if current:
        shops.append(current)

    return shops


def parse_compare_country_sales(text: str) -> list[dict[str, Any]]:
    """Parse compare_country_sales MCP response."""
    countries = []
    current = None

    lines = text.split("\r\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line.startswith("■ "):
            if current:
                countries.append(current)
            current = {
                "country": line[2:].strip(),
                "local_amount": 0.0,
                "local_currency": "",
                "sales_count": 0,
                "usd_amount": 0.0,
                "pct": 0.0,
                "avg_ticket_usd": 0.0,
            }
        elif current and line.startswith("Local :"):
            match = re.search(r"(\w+)\s+([\d,]+\.?\d*)\s*\((\d+)\s*sales\)", line)
            if match:
                current["local_currency"] = match.group(1)
                current["local_amount"] = float(match.group(2).replace(",", ""))
                current["sales_count"] = int(match.group(3))
        elif current and "USD" in line and ":" in line and "ticket" not in line.lower():
            match = re.search(r"USD\s+([\d,]+\.?\d*)\s*\(([\d.]+)%", line)
            if match:
                current["usd_amount"] = float(match.group(1).replace(",", ""))
                current["pct"] = float(match.group(2))
        elif current and "Avg ticket:" in line:
            match = re.search(r"USD\s+([\d,]+\.?\d*)", line)
            if match:
                current["avg_ticket_usd"] = float(match.group(1).replace(",", ""))

    if current:
        countries.append(current)

    return countries


def parse_top_models(text: str) -> list[dict[str, Any]]:
    """Parse top_models MCP response."""
    models = []
    lines = text.split("\r\n")

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # Match lines like " 1. IPHONE 17 PRO MAX $"
        rank_match = re.match(r"^\s*(\d+)\.\s+(.+)$", line)
        if rank_match:
            model_entry = {
                "rank": int(rank_match.group(1)),
                "model": rank_match.group(2).strip(),
                "units": 0,
                "amount": 0.0,
            }
            # Next line has "     217 units, AED 49,362.38"
            if i + 1 < len(lines):
                detail = lines[i + 1].strip()
                units_match = re.search(r"(\d+)\s*units", detail)
                amt_match = re.search(r"[\w]+\s+([\d,]+\.?\d*)", detail)
                if units_match:
                    model_entry["units"] = int(units_match.group(1))
                if amt_match:
                    model_entry["amount"] = float(amt_match.group(1).replace(",", ""))
            models.append(model_entry)
        i += 1

    return models


def parse_shop_stock_position(text: str) -> list[dict[str, Any]]:
    """Parse shop_stock_position MCP response."""
    shops = []
    current_shop = None

    lines = text.split("\r\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line.startswith("■ "):
            if current_shop:
                shops.append(current_shop)
            current_shop = {
                "shop": line[2:].strip(),
                "items": [],
                "total_units": 0,
            }
        elif current_shop and re.match(r"^-\d+", line):
            match = re.match(r"^(-?\d+)\s+(.+)$", line)
            if match:
                count = int(match.group(1))
                detail = match.group(2).strip()
                parts = detail.split(" / ")
                item = {
                    "count": count,
                    "model": parts[0].strip() if parts else detail,
                    "material": parts[1].strip() if len(parts) > 1 else "",
                    "position": parts[2].strip() if len(parts) > 2 else "",
                }
                current_shop["items"].append(item)
                current_shop["total_units"] += count

    if current_shop:
        shops.append(current_shop)

    return shops


def parse_pending_items(text: str) -> list[dict[str, Any]]:
    """Parse pending_items_by_shop MCP response."""
    shops = []
    current = None

    lines = text.split("\r\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line.startswith("■ "):
            if current:
                shops.append(current)
            current = {
                "shop": line[2:].strip(),
                "email": "",
                "payment_pending": 0,
                "installation_pending": 0,
                "items": [],
            }
        elif current and "Email:" in line:
            match = re.search(r"Email:\s*(\S+)", line)
            if match:
                current["email"] = match.group(1)
        elif current and "Payment Pending:" in line:
            current["payment_pending"] = _parse_int(line.split(":")[1])
        elif current and "Installation Pending:" in line:
            current["installation_pending"] = _parse_int(line.split(":")[1])
        elif current and line.startswith("#"):
            current["items"].append(line)

    if current:
        shops.append(current)

    return shops


def parse_daybook_summary(text: str) -> list[dict[str, Any]]:
    """Parse daybook_summary MCP response."""
    days = []
    current = None

    lines = text.split("\r\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Match date lines like "01-Aug-2026"
        date_match = re.match(r"(\d{2}-\w+-\d{4})", line)
        if date_match:
            if current:
                days.append(current)
            current = {
                "date": date_match.group(1),
                "opening": 0.0,
                "income": 0.0,
                "expense": 0.0,
                "closing": 0.0,
                "is_closed": False,
            }
        elif current:
            lower = line.lower()
            if "opening" in lower and ":" in line:
                current["opening"] = _parse_amount(line.split(":")[1])
            elif "income" in lower and ":" in line:
                current["income"] = _parse_amount(line.split(":")[1])
            elif "expense" in lower and ":" in line:
                current["expense"] = _parse_amount(line.split(":")[1])
            elif "closing" in lower and ":" in line:
                current["closing"] = _parse_amount(line.split(":")[1])
            elif "closed" in lower:
                current["is_closed"] = "yes" in lower

    if current:
        days.append(current)

    return days


def parse_cashbook_summary(text: str) -> dict[str, Any]:
    """Parse cashbook_summary MCP response."""
    result = {"opening": 0.0, "income": 0.0, "expense": 0.0, "balance": 0.0, "currency": ""}

    lines = text.split("\r\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue
        lower = line.lower()
        if "opening" in lower and ":" in line:
            result["opening"] = _parse_amount(line.split(":")[1])
        elif "income" in lower and ":" in line:
            result["income"] = _parse_amount(line.split(":")[1])
        elif "expense" in lower and ":" in line:
            result["expense"] = _parse_amount(line.split(":")[1])
        elif "balance" in lower and ":" in line:
            result["balance"] = _parse_amount(line.split(":")[1])

    return result
