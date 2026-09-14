#!/usr/bin/env python3
"""One-off cleanup for an already-seeded database: removes the fake demo
Team Leader / Telecaller accounts that seed.py used to create, reassigning
any stores they owned to the "Unassigned" placeholder team leader, and
grants the CEO role the users:view/create permissions it was missing
(seed.py only runs once on a fresh DB, so that permission fix needs to be
applied here directly too). Safe to re-run — skips anything already done.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.core.security import hash_password
from app.models.models import (
    User, Role, Permission, RolePermission, Store, UserStoreAccess, TeleSheetAssignment,
)

SEEDED_TL_EMAILS = [
    "breakprotectiontele@gmail.com", "breakprotectionkodchennai@gmail.com",
    "michael.breakprotection@gmail.com", "breakprotectionmarathahalli@gmail.com",
    "breakprotectionhytech@gmail.com", "breakprotectionindiranagar@gmail.com",
    "guwahati@breakprotection.com", "delhi@breakprotection.com",
    "kerala@breakprotection.com", "chennai@breakprotection.com",
    "mumbai@breakprotection.com",
]
SEEDED_TELECALLER_EMAILS = [
    "sanjay@breakprotection.com", "nazil.tele@breakprotection.com",
    "nirmala@breakprotection.com", "sam.tele@breakprotection.com",
    "ekbal@breakprotection.com",
]


async def get_or_create_unassigned_tl(db) -> User:
    result = await db.execute(select(User).where(User.email == "unassigned@system.local"))
    user = result.scalar_one_or_none()
    if user:
        return user
    tl_role = (await db.execute(select(Role).where(Role.name == "Team Leader"))).scalar_one_or_none()
    if not tl_role:
        raise RuntimeError("Team Leader role not found — run seed.py first")
    user = User(
        name="Unassigned", email="unassigned@system.local",
        password_hash=hash_password("not-a-real-login"),
        role_id=tl_role.id, is_active=False,
    )
    db.add(user)
    await db.flush()
    return user


async def main():
    async with AsyncSessionLocal() as db:
        unassigned = await get_or_create_unassigned_tl(db)

        removed_users = 0
        reassigned_stores = 0
        for email in SEEDED_TL_EMAILS + SEEDED_TELECALLER_EMAILS:
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            if not user:
                continue

            stores = (await db.execute(
                select(Store).where(Store.team_leader_id == user.id)
            )).scalars().all()
            for store in stores:
                store.team_leader_id = unassigned.id
                reassigned_stores += 1

            access_rows = (await db.execute(
                select(UserStoreAccess).where(UserStoreAccess.user_id == user.id)
            )).scalars().all()
            for row in access_rows:
                await db.delete(row)

            sheet_rows = (await db.execute(
                select(TeleSheetAssignment).where(TeleSheetAssignment.user_id == user.id)
            )).scalars().all()
            for row in sheet_rows:
                await db.delete(row)

            await db.delete(user)
            removed_users += 1
            print(f"  Removed {email}")

        ceo_role = (await db.execute(select(Role).where(Role.name == "CEO"))).scalar_one_or_none()
        if ceo_role:
            for action in ("view", "create"):
                perm = (await db.execute(
                    select(Permission).where(Permission.resource == "users", Permission.action == action)
                )).scalar_one_or_none()
                if not perm:
                    continue
                existing = (await db.execute(
                    select(RolePermission).where(
                        RolePermission.role_id == ceo_role.id, RolePermission.permission_id == perm.id
                    )
                )).scalar_one_or_none()
                if not existing:
                    db.add(RolePermission(role_id=ceo_role.id, permission_id=perm.id))
                    print(f"  Granted CEO users:{action}")

        await db.commit()
        print(f"\nDone. Removed {removed_users} seeded accounts, reassigned {reassigned_stores} stores to 'Unassigned'.")


if __name__ == "__main__":
    asyncio.run(main())
