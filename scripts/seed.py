#!/usr/bin/env python3
"""Seed script: creates all roles, permissions, users, stores, currencies, KPIs, bands."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import AsyncSessionLocal, engine
from app.db.base import Base
from app.core.security import hash_password
from app.models.models import (
    Role, Permission, RolePermission, User, UserStoreAccess,
    Store, Currency, KPIWeight, IncentiveBand, Setting,
)
from app.instagram.models import AIProvider
from app.instagram.form_models import IGForm, IGFormField
from sqlalchemy import select

RESOURCES = [
    "dashboard", "operations", "investments", "team_leaders",
    "leads", "campaigns", "tasks", "performance", "reports",
    "users", "roles", "settings", "sheet_sync", "instagram",
]
ACTIONS = ["view", "create", "edit", "delete", "export"]

ROLE_PERMISSIONS = {
    "SuperAdmin": {r: set(ACTIONS) for r in RESOURCES},
    "Admin": {r: set(ACTIONS) for r in RESOURCES},
    "CEO": {
        "dashboard": {"view"}, "team_leaders": {"view"},
        "operations": {"view"}, "leads": {"view"}, "campaigns": {"view"},
        "tasks": {"view"}, "performance": {"view", "edit", "export"},
        "reports": {"view", "export"}, "investments": {"view"},
        "instagram": {"view"},
    },
    "COO": {
        "dashboard": {"view"}, "team_leaders": {"view", "edit"},
        "operations": {"view"}, "leads": {"view"}, "campaigns": {"view"},
        "tasks": {"view"}, "performance": {"view", "edit", "export"},
        "reports": {"view", "export"}, "investments": {"view"},
        "instagram": {"view", "edit"},
    },
    "Regional Manager": {
        "dashboard": {"view"}, "team_leaders": {"view", "edit"},
        "operations": {"view", "edit"}, "leads": {"view", "edit"},
        "campaigns": {"view"}, "tasks": {"view", "edit"},
        "performance": {"view"}, "reports": {"view"},
        "instagram": {"view"},
    },
    "Team Leader": {
        "dashboard": {"view"}, "team_leaders": {"view"},
        "operations": {"view", "edit"}, "leads": {"view", "create", "edit"},
        "campaigns": {"view"}, "tasks": {"view", "create", "edit"},
        "performance": {"view"}, "reports": {"view"},
        "instagram": {"view"},
    },
    "Store Staff": {
        "dashboard": {"view"}, "operations": {"view", "create"},
        "leads": {"view", "create"}, "tasks": {"view"},
    },
    "Viewer": {
        "dashboard": {"view"}, "operations": {"view"},
        "team_leaders": {"view"}, "leads": {"view"},
        "campaigns": {"view"}, "tasks": {"view"},
        "performance": {"view"}, "reports": {"view"},
        "instagram": {"view"},
    },
}

STORES = [
    ("Kerala Kochi", "Harsh", 26667, 800000, "Kerala"),
    ("Kerala Trivandrum", "Sam", 16667, 500000, "Kerala"),
    ("Kerala Thrissur", "Michael", 10833, 325000, "Kerala"),
    ("Kerala Kannur", "Michael", 8333, 250000, "Kerala"),
    ("Kerala Calicut", "Harsh", 20000, 600000, "Kerala"),
    ("Mumbai Korum", "Abdullah", 6667, 200000, "Maharashtra"),
    ("Bangalore Marathahalli", "Vishnu", 10833, 325000, "Karnataka"),
    ("Mangalore", "Vishnu", 11667, 350000, "Karnataka"),
    ("Bangalore Indiranagar", "Nazil", 30000, 900000, "Karnataka"),
    ("Chennai Kodambakam", "Sam", 20000, 600000, "Tamil Nadu"),
    ("Chennai Velachery", "Sam", 13333, 400000, "Tamil Nadu"),
    ("Mumbai Bandra", "Abdullah", 6667, 200000, "Maharashtra"),
    ("Kerala Palakkad", "Michael", 11667, 350000, "Kerala"),
    ("Delhi Lajpat Nagar", "Abdullah", 8333, 250000, "Delhi"),
    ("Guwahati", "Michael", 8333, 250000, "Assam"),
    ("Kerala Pathanamthitta", "Michael", 8333, 250000, "Kerala"),
    ("Hyderabad Kukatpally", "Abdullah", 20000, 600000, "Telangana"),
    ("Hyderabad Hitech", "Abdullah", 20000, 600000, "Telangana"),
    ("Tn Coimbatore", "Sam", 16667, 500000, "Tamil Nadu"),
    ("Kerala Kasargod", "Michael", 10833, 325000, "Kerala"),
    ("Kerala Kollam", "Sam", 8333, 250000, "Kerala"),
    ("Mysore", "Vishnu", 9167, 275000, "Karnataka"),
    ("Kerala Kottkal", "Harsh", 18333, 550000, "Kerala"),
    ("Kerala Wayanad", "Harsh", 10000, 300000, "Kerala"),
]

TL_EMAILS = {
    "Harsh": "breakprotectiontele@gmail.com",
    "Sam": "breakprotectionkodchennai@gmail.com",
    "Michael": "michael.breakprotection@gmail.com",
    "Vishnu": "breakprotectionmarathahalli@gmail.com",
    "Abdullah": "breakprotectionhytech@gmail.com",
    "Nazil": "breakprotectionmarathahalli@gmail.com",
}

KPI_WEIGHTS = [
    ("Revenue vs Target", "Revenue achievement against monthly target", 0.30),
    ("DSR Submission Rate", "Daily submission completeness", 0.10),
    ("Walk-in Conversion", "Walk-in to sale conversion rate", 0.10),
    ("Cash Management", "Cash reconciliation accuracy", 0.10),
    ("Care+ Attachment Rate", "Care+ product attachment (TBD weight)", 0.00),
    ("Calls vs Target", "Outbound calls against daily target", 0.10),
    ("Stock Control", "Stock variance minimization", 0.10),
    ("Training Compliance", "Training completion rate", 0.05),
    ("BP App Update Rate", "BP app update compliance", 0.05),
    ("Complaint Resolution", "Complaint resolution rate", 0.10),
]

INCENTIVE_BANDS = [
    ("Star", 1.10, 1.40, "140% Star"),
    ("Above Target", 1.00, 1.20, "120% Accelerated"),
    ("On Target", 0.90, 1.00, "100% Full Pay"),
    ("Below Target", 0.00, 1.00, "Below Target - TBD, confirm with Abhin"),
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Check if already seeded
        existing = await db.execute(select(Role))
        if existing.scalars().first():
            print("Already seeded. Skipping.")
            return

        # 1. Currencies
        currencies = [
            Currency(code="INR", name="Indian Rupee", symbol="\u20b9", decimal_places=2, number_format_style="indian"),
            Currency(code="USD", name="US Dollar", symbol="$", decimal_places=2, number_format_style="western"),
            Currency(code="GBP", name="British Pound", symbol="\u00a3", decimal_places=2, number_format_style="western"),
            Currency(code="AED", name="UAE Dirham", symbol="AED", decimal_places=2, number_format_style="western"),
            Currency(code="EUR", name="Euro", symbol="\u20ac", decimal_places=2, number_format_style="western"),
        ]
        db.add_all(currencies)
        await db.flush()
        print(f"  Created {len(currencies)} currencies")

        # 2. Roles
        role_objs = {}
        for name in ROLE_PERMISSIONS:
            role = Role(name=name, description=f"{name} role")
            db.add(role)
            await db.flush()
            role_objs[name] = role
        print(f"  Created {len(role_objs)} roles")

        # 3. Permissions + role_permissions
        perm_objs = {}
        for res in RESOURCES:
            for act in ACTIONS:
                perm = Permission(resource=res, action=act)
                db.add(perm)
                await db.flush()
                perm_objs[(res, act)] = perm

        for role_name, perms_map in ROLE_PERMISSIONS.items():
            role = role_objs[role_name]
            for res, acts in perms_map.items():
                for act in acts:
                    perm = perm_objs.get((res, act))
                    if perm:
                        db.add(RolePermission(role_id=role.id, permission_id=perm.id))
        await db.flush()
        print(f"  Created {len(perm_objs)} permissions + role assignments")

        # 4. SuperAdmin user
        admin = User(
            name="SuperAdmin",
            email="admin@breakprotection.com",
            password_hash=hash_password("admin123"),
            role_id=role_objs["SuperAdmin"].id,
            is_active=True,
        )
        db.add(admin)
        await db.flush()
        print("  Created SuperAdmin (admin@breakprotection.com / admin123)")

        # COO
        coo = User(
            name="COO",
            email="coo@breakprotection.com",
            password_hash=hash_password("coo123"),
            role_id=role_objs["COO"].id,
            is_active=True,
        )
        db.add(coo)
        await db.flush()
        print("  Created COO (coo@breakprotection.com / coo123)")

        # 5. Team Leaders
        tl_users = {}
        for tl_name, email in TL_EMAILS.items():
            if tl_name not in tl_users:
                user = User(
                    name=tl_name,
                    email=email,
                    password_hash=hash_password(f"{tl_name.lower()}123"),
                    role_id=role_objs["Team Leader"].id,
                    is_active=True,
                )
                db.add(user)
                await db.flush()
                tl_users[tl_name] = user
        print(f"  Created {len(tl_users)} Team Leaders")

        # 6. Stores
        store_objs = {}
        for store_name, tl_name, daily, monthly, region in STORES:
            store = Store(
                name=store_name,
                team_leader_id=tl_users[tl_name].id,
                currency_code="INR",
                daily_target=daily,
                monthly_target=monthly,
                region=region,
            )
            db.add(store)
            await db.flush()
            store_objs[store_name] = store
            db.add(UserStoreAccess(user_id=tl_users[tl_name].id, store_id=store.id))
        await db.flush()
        print(f"  Created {len(store_objs)} stores + TL access links")

        # 7. KPI Weights
        for name, desc, weight in KPI_WEIGHTS:
            db.add(KPIWeight(kpi_name=name, description=desc, weight=weight))
        print(f"  Created {len(KPI_WEIGHTS)} KPI weights")

        # 8. Incentive Bands
        for name, min_score, multiplier, label in INCENTIVE_BANDS:
            db.add(IncentiveBand(band_name=name, min_kpi_score=min_score, multiplier=multiplier, label=label))
        print(f"  Created {len(INCENTIVE_BANDS)} incentive bands")

        # 9. Settings
        db.add(Setting(key="base_reporting_currency", value="INR"))
        db.add(Setting(key="same_day_edit_window_hours", value="12"))
        print("  Created settings")

        # 10. AI Providers (inactive by default)
        db.add(AIProvider(provider="claude", api_key_encrypted="NOT_CONFIGURED", model_name="claude-sonnet-4-6", is_active=False))
        db.add(AIProvider(provider="openai", api_key_encrypted="NOT_CONFIGURED", model_name="gpt-4o", is_active=False))
        print("  Created AI providers (Claude + OpenAI, inactive)")

        # 11. Default Instagram Forms
        complaint_form = IGForm(name="complaint", display_name="Complaint Form", description="File a customer complaint", form_type="simple", ai_prompt_hint="Trigger when the customer wants to raise a complaint or has an issue with a product or service", success_message="Thank you! Your complaint has been recorded. We'll get back to you within 24 hours.")
        db.add(complaint_form)
        await db.flush()

        db.add(IGFormField(form_id=complaint_form.id, field_key="name", label="Your Name", field_type="text", required=True, placeholder="Please provide your full name:", phase=1, sort_order=0))
        db.add(IGFormField(form_id=complaint_form.id, field_key="phone", label="Phone Number", field_type="phone", required=True, placeholder="Please share your phone number so we can contact you:", phase=1, sort_order=1))
        db.add(IGFormField(form_id=complaint_form.id, field_key="complaint", label="Complaint Details", field_type="text", required=True, placeholder="Please describe your complaint:", phase=1, sort_order=2))

        callback_form = IGForm(name="callback", display_name="Callback Request", description="Request a callback from our team", form_type="simple", ai_prompt_hint="Trigger when the customer asks for a call back or wants someone to call them", success_message="Thank you! We've noted your request. Our team will call you back shortly.")
        db.add(callback_form)
        await db.flush()

        db.add(IGFormField(form_id=callback_form.id, field_key="name", label="Your Name", field_type="text", required=True, placeholder="Please provide your name:", phase=1, sort_order=0))
        db.add(IGFormField(form_id=callback_form.id, field_key="phone", label="Phone Number", field_type="phone", required=True, placeholder="Please share your phone number for the callback:", phase=1, sort_order=1))

        booking_form = IGForm(name="booking", display_name="Store Visit Booking", description="Book a visit to one of our stores", form_type="two_phase", ai_prompt_hint="Trigger when the customer wants to visit a store, schedule an appointment, see products in person, or book a demo", success_message="Thank you! Your details are saved. Please complete your booking by selecting your preferred options.")
        db.add(booking_form)
        await db.flush()

        db.add(IGFormField(form_id=booking_form.id, field_key="name", label="Your Name", field_type="text", required=True, placeholder="Please provide your name:", phase=1, sort_order=0))
        db.add(IGFormField(form_id=booking_form.id, field_key="phone", label="Phone Number", field_type="phone", required=True, placeholder="Please share your phone number:", phase=1, sort_order=1))
        db.add(IGFormField(form_id=booking_form.id, field_key="mobile_model", label="Mobile Model", field_type="select", required=True, options=[
            {"value": "iphone_16_pro", "label": "iPhone 16 Pro"},
            {"value": "iphone_16", "label": "iPhone 16"},
            {"value": "samsung_s25_ultra", "label": "Samsung Galaxy S25 Ultra"},
            {"value": "samsung_s25", "label": "Samsung Galaxy S25"},
            {"value": "google_pixel_9", "label": "Google Pixel 9"},
            {"value": "oneplus_13", "label": "OnePlus 13"},
            {"value": "other", "label": "Other"},
        ], placeholder="Select a mobile model", phase=2, sort_order=2, ai_extract_hint="The phone model the customer is interested in"))
        db.add(IGFormField(form_id=booking_form.id, field_key="branch", label="Preferred Branch", field_type="select", required=True, options=[], placeholder="Select your preferred store", phase=2, sort_order=3, ai_extract_hint="Which store branch they want to visit"))
        db.add(IGFormField(form_id=booking_form.id, field_key="visit_date", label="Preferred Date", field_type="date", required=True, placeholder="Select a date", phase=2, sort_order=4, ai_extract_hint="When they want to visit"))

        print("  Created default forms (complaint, callback, booking)")

        await db.commit()
        print("\nSeed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
