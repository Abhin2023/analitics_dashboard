#!/usr/bin/env python3
"""Factory-reset the operational data: deletes every user except SuperAdmin
and COO (recreating coo@breakprotection.com if it's missing), and deletes
every store, submission, lead, task, investment, tracker snapshot, and other
per-store/per-user record that depended on them — so the SuperAdmin/COO can
rebuild team leaders, stores, and assignments from scratch via the dashboard.

Left untouched (not "dummy" business data, so not wiped):
  - roles, permissions, role_permissions (RBAC structure)
  - currencies, exchange_rates, kpi_weights, incentive_bands (config)
  - sheet_sources, sheet_sync_log (sync configuration/history)
  - ai_summary_config (just has its updated_by reference cleared)
  - audit_log (kept for history, just has its user_id reference cleared)
  - international_stores (manually-entered UAE/Oman figures, not user/store-linked)

Irreversible. Take a mysqldump backup before running this.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, delete, update
from app.db.session import AsyncSessionLocal
from app.core.security import hash_password
from app.models.models import (
    User, Role, Store, UserStoreAccess, TeleSheetAssignment,
    DailySubmission, Lead, LeadActivity, LostReason, Task, GoogleReview,
    Investment, MarketingMetrics, StoreStaff, DailyStoreTracker,
    McpDailySale, StoreDashboardSnapshot, Campaign, TeleCallLead,
    StrategicInsight, SheetSource, Setting, AISummaryConfig, AuditLog,
)

KEEP_ROLE_NAMES = ("SuperAdmin", "COO")
COO_EMAIL = "coo@breakprotection.com"
COO_PASSWORD = "coo123"


async def main():
    async with AsyncSessionLocal() as db:
        coo_role = (await db.execute(select(Role).where(Role.name == "COO"))).scalar_one_or_none()
        if not coo_role:
            raise RuntimeError("COO role not found — the roles table itself looks wiped, aborting")

        coo_user = (await db.execute(select(User).where(User.email == COO_EMAIL))).scalar_one_or_none()
        if coo_user:
            print(f"  COO account already exists ({COO_EMAIL})")
        else:
            coo_user = User(
                name="COO", email=COO_EMAIL,
                password_hash=hash_password(COO_PASSWORD),
                role_id=coo_role.id, is_active=True,
            )
            db.add(coo_user)
            await db.flush()
            print(f"  Recreated COO account: {COO_EMAIL} / {COO_PASSWORD}")

        keep_role_ids = [
            r.id for r in (await db.execute(select(Role).where(Role.name.in_(KEEP_ROLE_NAMES)))).scalars().all()
        ]
        keep_user_ids = [
            u.id for u in (await db.execute(select(User).where(User.role_id.in_(keep_role_ids)))).scalars().all()
        ]
        print(f"  Keeping {len(keep_user_ids)} user(s): role(s) {KEEP_ROLE_NAMES}")

        # Children of Store/User first, then Store, then User.
        counts = {}
        for model in (
            LeadActivity, Lead, LostReason, Task, GoogleReview, Investment,
            MarketingMetrics, StoreStaff, DailyStoreTracker, McpDailySale,
            StoreDashboardSnapshot, DailySubmission, UserStoreAccess,
            TeleSheetAssignment, Campaign, TeleCallLead, StrategicInsight,
        ):
            result = await db.execute(delete(model))
            counts[model.__tablename__] = result.rowcount

        result = await db.execute(delete(Store))
        counts["stores"] = result.rowcount

        # Config tables we keep — just detach the "created/updated by"
        # pointer so deleting the user below doesn't hit a FK constraint.
        for model, col in (
            (SheetSource, SheetSource.created_by),
            (Setting, Setting.updated_by),
            (AISummaryConfig, AISummaryConfig.updated_by),
            (AuditLog, AuditLog.user_id),
        ):
            await db.execute(update(model).where(~col.in_(keep_user_ids)).values(**{col.key: None}))

        result = await db.execute(delete(User).where(User.role_id.notin_(keep_role_ids)))
        counts["users"] = result.rowcount

        await db.commit()

        print("\nDeleted rows:")
        for table, n in counts.items():
            print(f"  {table}: {n}")
        print(f"\nDone. Only {KEEP_ROLE_NAMES} users remain.")


if __name__ == "__main__":
    asyncio.run(main())
