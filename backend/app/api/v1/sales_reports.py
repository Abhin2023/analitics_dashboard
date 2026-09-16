from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from ...core.deps import get_db, require_admin_tier
from ...models.models import User
from ...services.sales_report_service import (
    get_sales_report, get_live_today_revenue, get_country_comparison_snapshot,
)

router = APIRouter(prefix="/sales-reports", tags=["sales-reports"])


@router.get("")
async def sales_report(
    granularity: str = "month",
    start: str = None,
    end: str = None,
    team_leader_id: int = None,
    store_id: int = None,
    country: str = None,
    region: str = None,
    group_by: str = "none",
    db: AsyncSession = Depends(get_db),
    _user: User = require_admin_tier(),
):
    """Unified sales report combining MCP (all countries, authoritative for
    revenue/target) with Sheets-sourced funnel metrics (India only), bucketed
    by day/week/month and optionally grouped by team leader, branch, or region.
    """
    return await get_sales_report(
        db, granularity=granularity, start=start, end=end,
        team_leader_id=team_leader_id, store_id=store_id,
        country=country, region=region, group_by=group_by,
    )


@router.get("/live-today")
async def live_today(
    country: str = "India",
    db: AsyncSession = Depends(get_db),
    _user: User = require_admin_tier(),
):
    """Today's revenue for a country, from the stored mcp_daily_sales table
    (kept fresh by the regular background sync) rather than calling MCP
    directly on every dashboard load."""
    return await get_live_today_revenue(db, country)


@router.get("/country-comparison")
async def country_comparison(
    db: AsyncSession = Depends(get_db),
    _user: User = require_admin_tier(),
):
    """Per-country sales normalized to USD, as captured during the last
    sync (see sync_mcp_sales) rather than calling MCP directly."""
    return await get_country_comparison_snapshot(db)
