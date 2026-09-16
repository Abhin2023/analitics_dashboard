"""Single source of truth for "merge store A into store B" — used by the
Branch Assignment UI's "Merge into..." button, and by every cleanup script
(apply_branch_decisions.py, full_reconciliation.py, merge_legacy_duplicates.py,
dedupe_mcp_stores.py). Having one implementation matters: an earlier version
of this logic only moved McpDailySale rows, which was enough for
freshly-auto-created MCP branches (they never accumulate anything else) but
silently orphaned real historical data — Google reviews, staff records,
walk-in submissions, leads — on any older, Sheets-sourced branch that turned
out to be a duplicate.

Which tables need collision-safe (check-then-repoint) handling below was
verified against the LIVE database schema (`SHOW INDEX`), not just the
SQLAlchemy model definitions — daily_submissions, daily_store_tracker, and
store_dashboard_snapshots all have a real (store_id, date) unique index at
the database level that isn't declared anywhere in models.py. Trusting the
model alone here caused a real IntegrityError during testing; don't assume
a table has "no extra uniqueness" without checking the actual schema.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from ..models.models import (
    Store, StoreMcpAlias, McpDailySale, DailySubmission, Lead, LostReason,
    GoogleReview, MarketingMetrics, StoreStaff, DailyStoreTracker,
    StoreDashboardSnapshot, Task, Investment, User, UserStoreAccess,
)

# Tables keyed only by store_id, confirmed via SHOW INDEX to have no other
# uniqueness — a plain bulk UPDATE is safe for each.
_SIMPLE_REPOINT_MODELS = [Lead, LostReason, GoogleReview, MarketingMetrics, StoreStaff, Task, Investment]

# (model, date_column) pairs confirmed via SHOW INDEX to have a real
# (store_id, date-ish column) unique index at the database level — need
# collision handling, not a blind bulk UPDATE.
_DATE_KEYED_MODELS = [
    (DailySubmission, DailySubmission.date),
    (DailyStoreTracker, DailyStoreTracker.date),
    (StoreDashboardSnapshot, StoreDashboardSnapshot.snapshot_date),
    (McpDailySale, McpDailySale.date),
]


async def _repoint_date_keyed(db: AsyncSession, model, date_col, source_id: int, target_id: int) -> None:
    """Re-points `model` rows from source_id to target_id, dropping the
    source's row for any date the target already has one (the target's
    existing figure for that date is kept)."""
    existing_dates = {row[0] for row in (await db.execute(
        select(date_col).where(model.store_id == target_id)
    )).all()}
    colliding = (await db.execute(
        select(model).where(model.store_id == source_id, date_col.in_(existing_dates))
    )).scalars().all()
    for row in colliding:
        await db.delete(row)
    await db.flush()
    await db.execute(update(model).where(model.store_id == source_id).values(store_id=target_id))


async def merge_store_into(db: AsyncSession, source: Store, target: Store) -> None:
    """Moves every record that references `source` onto `target`, then
    deletes `source`. Does not commit — the caller controls the transaction
    (so it can be part of a larger batch, or rolled back on error)."""

    for model, date_col in _DATE_KEYED_MODELS:
        await _repoint_date_keyed(db, model, date_col, source.id, target.id)

    # UserStoreAccess has a composite (user_id, store_id) primary key — drop
    # the source's grant for any user who already has access to the target,
    # then re-point the rest.
    target_user_ids = {row[0] for row in (await db.execute(
        select(UserStoreAccess.user_id).where(UserStoreAccess.store_id == target.id)
    )).all()}
    dup_access = (await db.execute(
        select(UserStoreAccess).where(
            UserStoreAccess.store_id == source.id, UserStoreAccess.user_id.in_(target_user_ids)
        )
    )).scalars().all()
    for row in dup_access:
        await db.delete(row)
    await db.flush()
    await db.execute(
        update(UserStoreAccess).where(UserStoreAccess.store_id == source.id).values(store_id=target.id)
    )

    # Every other table referencing store_id has no extra uniqueness to
    # worry about — plain bulk re-point.
    for model in _SIMPLE_REPOINT_MODELS:
        await db.execute(update(model).where(model.store_id == source.id).values(store_id=target.id))

    # Users directly assigned to this store as their home branch.
    await db.execute(update(User).where(User.store_id == source.id).values(store_id=target.id))

    # The source's country came straight from MCP when it was created (or,
    # for older Sheets-based branches, may simply be more carefully set)
    # and is preferred if it disagrees with the target's — otherwise a
    # merge can silently leave revenue misfiled under the wrong country.
    if source.country and source.country != target.country:
        target.country = source.country
        target.mcp_country_id = source.mcp_country_id

    # Permanently remember every name this store was ever known by — its
    # MCP shop name AND its plain Store.name — so a future sale (from MCP)
    # or sheet row (from the Google Sheets sync) reported under either name
    # is recognized instantly instead of spinning up a fresh duplicate. This
    # matters even for branches with no mcp_shop_name at all: the Sheets
    # sync matches purely by Store.name, so without recording that name
    # here too, deleting a Sheets-based duplicate just gets it silently
    # recreated the next time that sheet syncs.
    names_to_remember = {n for n in (source.mcp_shop_name, source.name) if n}
    for name in names_to_remember:
        stmt = select(StoreMcpAlias).where(StoreMcpAlias.mcp_shop_name == name)
        existing_alias = (await db.execute(stmt)).scalar_one_or_none()
        if existing_alias:
            existing_alias.store_id = target.id
        else:
            db.add(StoreMcpAlias(store_id=target.id, mcp_shop_name=name))
    await db.execute(
        update(StoreMcpAlias).where(StoreMcpAlias.store_id == source.id).values(store_id=target.id)
    )

    await db.flush()
    await db.delete(source)
