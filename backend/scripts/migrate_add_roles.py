#!/usr/bin/env python3
"""Migration script: adds Telecaller + Salesperson roles, 5 city-based TLs,
5 salespersons, 5 telecallers, and 5 stores. Safe to run multiple times."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import AsyncSessionLocal
from app.core.security import hash_password
from app.models.models import (
    Role, Permission, RolePermission, User, UserStoreAccess,
    Store, TeleSheetAssignment,
)
from sqlalchemy import select, text

ROLE_PERMISSIONS = {
    "Telecaller": {
        "dashboard": {"view"}, "leads": {"view", "create", "edit"},
        "operations": {"view"},
    },
    "Salesperson": {
        "dashboard": {"view"}, "leads": {"view", "create", "edit"},
        "operations": {"view", "create"}, "tasks": {"view", "create"},
    },
}

CITY_TLS = [
    ("Guwahati", "guwahati@breakprotection.com", "Guwahati Store", "Assam", 15000, 450000),
    ("Delhi", "delhi@breakprotection.com", "Delhi Store", "Delhi", 20000, 600000),
    ("Kerala", "kerala@breakprotection.com", "Kerala Store", "Kerala", 18000, 540000),
    ("Chennai", "chennai@breakprotection.com", "Chennai Store", "Tamil Nadu", 16667, 500000),
    ("Mumbai", "mumbai@breakprotection.com", "Mumbai Store", "Maharashtra", 20000, 600000),
]

SALESPERSONS = [
    ("Ravi", "ravi@breakprotection.com", "Guwahati"),
    ("Amit", "amit@breakprotection.com", "Delhi"),
    ("Priya", "priya@breakprotection.com", "Kerala"),
    ("Deepak", "deepak@breakprotection.com", "Chennai"),
    ("Rohit", "rohit@breakprotection.com", "Mumbai"),
]

TELECALLERS = [
    ("SANJAY", "sanjay@breakprotection.com"),
    ("Nazil Tele", "nazil.tele@breakprotection.com"),
    ("Nirmala", "nirmala@breakprotection.com"),
    ("SAM Tele", "sam.tele@breakprotection.com"),
    ("Ekbal", "ekbal@breakprotection.com"),
]

# User → City Sheet assignments
SHEET_ASSIGNMENTS = [
    # Telecallers
    ("sanjay@breakprotection.com", "Kerala"),
    ("nazil.tele@breakprotection.com", "Bangalore"),
    ("nirmala@breakprotection.com", "Delhi"),
    ("sam.tele@breakprotection.com", "Chennai"),
    ("ekbal@breakprotection.com", "Guwahati"),
    # City-based Team Leaders
    ("guwahati@breakprotection.com", "Guwahati"),
    ("delhi@breakprotection.com", "Delhi"),
    ("kerala@breakprotection.com", "Kerala"),
    ("chennai@breakprotection.com", "Chennai"),
    ("mumbai@breakprotection.com", "Bangalore"),
]


async def migrate():
    async with AsyncSessionLocal() as db:
        # 0. Add edited_by_user column to tele_call_leads if missing
        try:
            await db.execute(text(
                "ALTER TABLE tele_call_leads ADD COLUMN edited_by_user BOOLEAN DEFAULT FALSE"
            ))
            print("  Added edited_by_user column to tele_call_leads")
        except Exception:
            print("  edited_by_user column already exists")

        # 1. Create Telecaller + Salesperson roles (skip if exist)
        role_objs = {}
        for role_name, perms_map in ROLE_PERMISSIONS.items():
            result = await db.execute(select(Role).where(Role.name == role_name))
            role = result.scalar_one_or_none()
            if not role:
                role = Role(name=role_name, description=f"{role_name} role")
                db.add(role)
                await db.flush()
                print(f"  Created role: {role_name}")
            else:
                print(f"  Role already exists: {role_name}")
            role_objs[role_name] = role

        # 2. Create permissions for new roles if missing
        for role_name, perms_map in ROLE_PERMISSIONS.items():
            role = role_objs[role_name]
            for res, acts in perms_map.items():
                for act in acts:
                    result = await db.execute(
                        select(Permission).where(
                            Permission.resource == res, Permission.action == act
                        )
                    )
                    perm = result.scalar_one_or_none()
                    if not perm:
                        perm = Permission(resource=res, action=act)
                        db.add(perm)
                        await db.flush()
                    # Link role-permission if not already linked
                    result = await db.execute(
                        select(RolePermission).where(
                            RolePermission.role_id == role.id,
                            RolePermission.permission_id == perm.id,
                        )
                    )
                    if not result.scalar_one_or_none():
                        db.add(RolePermission(role_id=role.id, permission_id=perm.id))
        await db.flush()
        print("  Permissions linked")

        # 3. Create 5 city-based TLs + stores
        tl_role_result = await db.execute(select(Role).where(Role.name == "Team Leader"))
        tl_role = tl_role_result.scalar_one()
        tl_users = {}

        for tl_name, email, store_name, region, daily, monthly in CITY_TLS:
            # Create TL user if not exists
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            if not user:
                user = User(
                    name=tl_name, email=email,
                    password_hash=hash_password(f"{tl_name.lower()}123"),
                    role_id=tl_role.id, is_active=True,
                )
                db.add(user)
                await db.flush()
                print(f"  Created TL: {tl_name} ({email})")
            else:
                print(f"  TL already exists: {tl_name}")
            tl_users[tl_name] = user

            # Create store if not exists
            result = await db.execute(select(Store).where(Store.name == store_name))
            store = result.scalar_one_or_none()
            if not store:
                store = Store(
                    name=store_name, team_leader_id=user.id,
                    currency_code="INR", daily_target=daily,
                    monthly_target=monthly, region=region, is_active=True,
                )
                db.add(store)
                await db.flush()
                print(f"  Created store: {store_name}")
            else:
                print(f"  Store already exists: {store_name}")

            # Link TL to store
            result = await db.execute(
                select(UserStoreAccess).where(
                    UserStoreAccess.user_id == user.id,
                    UserStoreAccess.store_id == store.id,
                )
            )
            if not result.scalar_one_or_none():
                db.add(UserStoreAccess(user_id=user.id, store_id=store.id))

        await db.flush()

        # 4. Create salespersons
        sp_role_result = await db.execute(select(Role).where(Role.name == "Salesperson"))
        sp_role = sp_role_result.scalar_one()

        for sp_name, sp_email, sp_tl_city in SALESPERSONS:
            result = await db.execute(select(User).where(User.email == sp_email))
            user = result.scalar_one_or_none()
            if not user:
                user = User(
                    name=sp_name, email=sp_email,
                    password_hash=hash_password(f"{sp_name.lower()}123"),
                    role_id=sp_role.id, is_active=True,
                )
                db.add(user)
                await db.flush()
                print(f"  Created salesperson: {sp_name} ({sp_email})")
            else:
                print(f"  Salesperson already exists: {sp_name}")

            # Grant access to their TL's store
            store_name = f"{sp_tl_city} Store"
            result = await db.execute(select(Store).where(Store.name == store_name))
            store = result.scalar_one_or_none()
            if store:
                result = await db.execute(
                    select(UserStoreAccess).where(
                        UserStoreAccess.user_id == user.id,
                        UserStoreAccess.store_id == store.id,
                    )
                )
                if not result.scalar_one_or_none():
                    db.add(UserStoreAccess(user_id=user.id, store_id=store.id))

        await db.flush()

        # 5. Create telecallers
        tc_role_result = await db.execute(select(Role).where(Role.name == "Telecaller"))
        tc_role = tc_role_result.scalar_one()

        for tc_name, tc_email in TELECALLERS:
            result = await db.execute(select(User).where(User.email == tc_email))
            user = result.scalar_one_or_none()
            if not user:
                user = User(
                    name=tc_name, email=tc_email,
                    password_hash=hash_password(f"{tc_name.split()[0].lower()}123"),
                    role_id=tc_role.id, is_active=True,
                )
                db.add(user)
                await db.flush()
                print(f"  Created telecaller: {tc_name} ({tc_email})")
            else:
                print(f"  Telecaller already exists: {tc_name}")

        # 6. Create sheet assignments (user → city sheet)
        for email, sheet_name in SHEET_ASSIGNMENTS:
            result = await db.execute(select(User).where(User.email == email))
            target_user = result.scalar_one_or_none()
            if not target_user:
                print(f"  Skipping assignment: user {email} not found")
                continue

            result = await db.execute(
                select(TeleSheetAssignment).where(
                    TeleSheetAssignment.user_id == target_user.id,
                    TeleSheetAssignment.sheet_tl_name == sheet_name,
                )
            )
            if result.scalar_one_or_none():
                print(f"  Assignment already exists: {target_user.name} → {sheet_name}")
                continue

            assignment = TeleSheetAssignment(
                user_id=target_user.id,
                sheet_tl_name=sheet_name,
            )
            db.add(assignment)
            print(f"  Assigned {target_user.name} → {sheet_name}")

        await db.commit()
        print("\nMigration complete!")


if __name__ == "__main__":
    asyncio.run(migrate())
