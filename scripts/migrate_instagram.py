#!/usr/bin/env python3
"""One-time migration: adds instagram permissions, AI providers, and default forms.

Safe to run multiple times — only inserts what's missing.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from app.db.session import AsyncSessionLocal
from app.models.models import Role, Permission, RolePermission
from app.instagram.models import AIProvider, IGAccount
from app.instagram.form_models import IGForm, IGFormField
from sqlalchemy import select

ACTIONS = ["view", "create", "edit", "delete", "export"]

ROLE_PERMISSIONS = {
    "SuperAdmin": {"instagram": set(ACTIONS)},
    "Admin": {"instagram": set(ACTIONS)},
    "CEO": {"instagram": {"view"}},
    "COO": {"instagram": {"view", "edit"}},
    "Regional Manager": {"instagram": {"view"}},
    "Team Leader": {"instagram": {"view"}},
    "Viewer": {"instagram": {"view"}},
}


async def migrate():
    async with AsyncSessionLocal() as db:
        # ── 1. Create instagram permission rows if missing ──────────
        perm_objs = {}
        for act in ACTIONS:
            result = await db.execute(
                select(Permission).where(Permission.resource == "instagram", Permission.action == act)
            )
            perm = result.scalar_one_or_none()
            if not perm:
                perm = Permission(resource="instagram", action=act)
                db.add(perm)
                await db.flush()
                print(f"  + Created permission: instagram:{act}")
            else:
                print(f"    Permission instagram:{act} already exists (id={perm.id})")
            perm_objs[act] = perm

        # ── 2. Link permissions to roles ────────────────────────────
        for role_name, perms_map in ROLE_PERMISSIONS.items():
            result = await db.execute(select(Role).where(Role.name == role_name))
            role = result.scalar_one_or_none()
            if not role:
                print(f"  ! Role '{role_name}' not found — skipping")
                continue

            for resource, acts in perms_map.items():
                for act in acts:
                    perm = perm_objs.get(act)
                    if not perm:
                        continue
                    existing = await db.execute(
                        select(RolePermission).where(
                            RolePermission.role_id == role.id,
                            RolePermission.permission_id == perm.id,
                        )
                    )
                    if not existing.scalar_one_or_none():
                        db.add(RolePermission(role_id=role.id, permission_id=perm.id))
                        print(f"  + Linked {role_name} -> instagram:{act}")
                    # else: already linked

        await db.flush()

        # ── 3. AI Providers if missing ──────────────────────────────
        for provider_name, model in [("claude", "claude-sonnet-4-6"), ("openai", "gpt-4o")]:
            result = await db.execute(select(AIProvider).where(AIProvider.provider == provider_name))
            if not result.scalar_one_or_none():
                db.add(AIProvider(provider=provider_name, api_key_encrypted="NOT_CONFIGURED", model_name=model, is_active=False))
                print(f"  + Created AI provider: {provider_name}")
            else:
                print(f"    AI provider '{provider_name}' already exists")

        # ── 4. Default Forms if missing ─────────────────────────────
        # Need an ig_account_id to satisfy the NOT NULL constraint on existing tables
        acct_result = await db.execute(
            select(IGAccount).where(IGAccount.ig_user_id != "PLACEHOLDER").limit(1)
        )
        real_acct = acct_result.scalar_one_or_none()

        if not real_acct:
            placeholder_result = await db.execute(
                select(IGAccount).where(IGAccount.ig_user_id == "PLACEHOLDER")
            )
            placeholder_acct = placeholder_result.scalar_one_or_none()
            if not placeholder_acct:
                from app.instagram.utils import encrypt_token
                placeholder = IGAccount(
                    ig_user_id="PLACEHOLDER",
                    page_id="0",
                    page_name="Setup pending - connect real account in IG Setup",
                    access_token_encrypted=encrypt_token("placeholder"),
                )
                db.add(placeholder)
                await db.flush()
                placeholder_acct_id = placeholder.id
                print("  + Created placeholder IG account for form linkage")
            else:
                placeholder_acct_id = placeholder_acct.id
        else:
            placeholder_acct_id = real_acct.id

        for form_name, display, desc, ftype, hint, msg, field_defs in [
            (
                "complaint", "Complaint Form", "File a customer complaint", "simple",
                "Trigger when the customer wants to raise a complaint or has an issue with a product or service",
                "Thank you! Your complaint has been recorded. We'll get back to you within 24 hours.",
                [
                    ("name", "Your Name", "text", True, [], "Please provide your full name:", 1, 0, ""),
                    ("phone", "Phone Number", "phone", True, [], "Please share your phone number so we can contact you:", 1, 1, ""),
                    ("complaint", "Complaint Details", "text", True, [], "Please describe your complaint:", 1, 2, ""),
                ],
            ),
            (
                "callback", "Callback Request", "Request a callback from our team", "simple",
                "Trigger when the customer asks for a call back or wants someone to call them",
                "Thank you! We've noted your request. Our team will call you back shortly.",
                [
                    ("name", "Your Name", "text", True, [], "Please provide your name:", 1, 0, ""),
                    ("phone", "Phone Number", "phone", True, [], "Please share your phone number for the callback:", 1, 1, ""),
                ],
            ),
            (
                "booking", "Store Visit Booking", "Book a visit to one of our stores", "two_phase",
                "Trigger when the customer wants to visit a store, schedule an appointment, see products in person, or book a demo",
                "Thank you! Your details are saved. Please complete your booking by selecting your preferred options.",
                [
                    ("name", "Your Name", "text", True, [], "Please provide your name:", 1, 0, ""),
                    ("phone", "Phone Number", "phone", True, [], "Please share your phone number:", 1, 1, ""),
                    ("mobile_model", "Mobile Model", "select", True, [
                        {"value": "iphone_16_pro", "label": "iPhone 16 Pro"},
                        {"value": "iphone_16", "label": "iPhone 16"},
                        {"value": "samsung_s25_ultra", "label": "Samsung Galaxy S25 Ultra"},
                        {"value": "samsung_s25", "label": "Samsung Galaxy S25"},
                        {"value": "google_pixel_9", "label": "Google Pixel 9"},
                        {"value": "oneplus_13", "label": "OnePlus 13"},
                        {"value": "other", "label": "Other"},
                    ], "Select a mobile model", 2, 2, "The phone model the customer is interested in"),
                    ("branch", "Preferred Branch", "select", True, [], "Select your preferred store", 2, 3, "Which store branch they want to visit"),
                    ("visit_date", "Preferred Date", "date", True, [], "Select a date", 2, 4, "When they want to visit"),
                ],
            ),
        ]:
            result = await db.execute(select(IGForm).where(IGForm.name == form_name))
            if result.scalar_one_or_none():
                print(f"    Form '{form_name}' already exists")
                continue

            form = IGForm(
                ig_account_id=placeholder_acct_id,
                name=form_name, display_name=display, description=desc,
                form_type=ftype, ai_prompt_hint=hint, success_message=msg, is_active=True,
            )
            db.add(form)
            await db.flush()

            for key, label, ftype_f, required, options, placeholder, phase, order, hint_f in field_defs:
                db.add(IGFormField(
                    form_id=form.id, field_key=key, label=label, field_type=ftype_f,
                    required=required, options=options, placeholder=placeholder,
                    phase=phase, sort_order=order, ai_extract_hint=hint_f,
                ))
            print(f"  + Created form: {form_name} ({len(field_defs)} fields)")

        await db.commit()
        print("\nInstagram migration complete!")


if __name__ == "__main__":
    asyncio.run(migrate())
