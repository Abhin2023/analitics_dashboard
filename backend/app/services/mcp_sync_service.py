import logging
from datetime import date, datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.mysql import insert as mysql_insert

from ..models.models import Store, User, McpDailySale, Setting
from .common import get_or_create_unassigned_tl
from .mcp_branches import MCP_COUNTRIES
from .mcp_daily_sales import get_daily_sales

logger = logging.getLogger(__name__)

LAST_SYNC_SETTING_KEY = "last_mcp_sync_at"


def _extract_city_token(mcp_shop_name: str) -> str:
    """MCP shop names look like 'Heavenly Treasure - Velachery' — the token
    after the last ' - ' is usually the city/branch identifier that can be
    matched against an existing Sheets-sourced Store name."""
    if " - " in mcp_shop_name:
        return mcp_shop_name.rsplit(" - ", 1)[-1].strip().lower()
    return mcp_shop_name.strip().lower()


async def _match_or_create_store(
    db: AsyncSession, mcp_shop_name: str, country_id: int, country_name: str
) -> tuple[Store, bool]:
    """Resolve an MCP shop name to a Store row. Returns (store, created)."""
    result = await db.execute(select(Store).where(Store.mcp_shop_name == mcp_shop_name))
    store = result.scalar_one_or_none()
    if store:
        return store, False

    if country_id == 1:
        # Try to match an existing India store (created by the Sheets sync)
        # by its city/branch token, since MCP and Sheets use different
        # naming conventions for the same physical branch.
        token = _extract_city_token(mcp_shop_name)
        candidates = (await db.execute(
            select(Store).where(Store.country == "India", Store.mcp_shop_name.is_(None))
        )).scalars().all()
        matches = [s for s in candidates if token and token in s.name.lower()]
        if len(matches) == 1:
            matches[0].mcp_shop_name = mcp_shop_name
            matches[0].mcp_country_id = country_id
            return matches[0], False
        # 0 or >1 matches: ambiguous, fall through to create a new store
        # flagged for manual review rather than guessing.

    placeholder_tl = await get_or_create_unassigned_tl(db)
    store = Store(
        name=mcp_shop_name,
        team_leader_id=placeholder_tl.id,
        country=country_name,
        mcp_country_id=country_id,
        mcp_shop_name=mcp_shop_name,
        needs_review=True,
        is_active=True,
    )
    db.add(store)
    await db.flush()
    return store, True


async def _set_last_sync_time(db: AsyncSession) -> None:
    result = await db.execute(select(Setting).where(Setting.key == LAST_SYNC_SETTING_KEY))
    setting = result.scalar_one_or_none()
    now_str = datetime.utcnow().isoformat()
    if setting:
        setting.value = now_str
    else:
        db.add(Setting(key=LAST_SYNC_SETTING_KEY, value=now_str))


async def sync_mcp_sales(
    db: AsyncSession, from_date: str = None, to_date: str = None
) -> dict:
    """Pull sales from MCP for every country (India included) over the given
    date range (defaults to month-to-date) and persist into mcp_daily_sales.
    """
    today = date.today()
    if not to_date:
        to_date = today.strftime("%Y-%m-%d")
    if not from_date:
        from_date = today.replace(day=1).strftime("%Y-%m-%d")

    rows_synced = 0
    new_stores = 0
    review_needed = 0
    errors: list[str] = []

    for country in MCP_COUNTRIES:
        try:
            daily_rows = await get_daily_sales(country["id"], from_date, to_date)
        except Exception as e:
            logger.warning("MCP sync failed for %s: %s", country["name"], e)
            errors.append(f"{country['name']}: {e}")
            continue

        for row in daily_rows:
            if not row.get("store"):
                continue
            store, created = await _match_or_create_store(
                db, row["store"], country["id"], country["name"]
            )
            if created:
                new_stores += 1
                if store.needs_review:
                    review_needed += 1

            sub_date = datetime.strptime(row["date"], "%Y-%m-%d").date()
            # Atomic upsert (not select-then-insert) so concurrent syncs for
            # an overlapping date range — e.g. two report requests triggering
            # a lazy backfill at the same time — can't race on the unique
            # (store_id, date) constraint.
            stmt = mysql_insert(McpDailySale).values(
                store_id=store.id, date=sub_date,
                revenue=row.get("revenue", 0), units_sold=row.get("units_sold", 0),
                new_sale_count=row.get("new_sale_count", 0),
                replacement_count=row.get("replacement_count", 0),
                return_count=row.get("return_count", 0),
                target=row.get("target", 0), currency="",
                synced_at=datetime.utcnow(),
            )
            stmt = stmt.on_duplicate_key_update(
                revenue=stmt.inserted.revenue,
                units_sold=stmt.inserted.units_sold,
                new_sale_count=stmt.inserted.new_sale_count,
                replacement_count=stmt.inserted.replacement_count,
                return_count=stmt.inserted.return_count,
                target=stmt.inserted.target,
                synced_at=stmt.inserted.synced_at,
            )
            await db.execute(stmt)
            rows_synced += 1

    await _set_last_sync_time(db)
    await db.commit()

    return {
        "status": "ok" if not errors else "partial",
        "rows_synced": rows_synced,
        "new_stores": new_stores,
        "stores_needing_review": review_needed,
        "countries_synced": len(MCP_COUNTRIES) - len(errors),
        "errors": errors,
    }
