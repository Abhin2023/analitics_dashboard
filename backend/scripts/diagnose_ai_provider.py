#!/usr/bin/env python3
"""Diagnoses why the AI Summary feature might be saying "no key detected"
even after updating a key in Settings -> AI Provider Configuration.

Checks, for every row in ai_providers:
  - Is it marked active? (ai_summary_service only ever reads the ONE
    active row -- if the row you updated isn't the active one, or nothing
    is active, this is exactly why it looks like the update "didn't work.")
  - Does it have a real key configured (not the NOT_CONFIGURED placeholder)?
  - Does decrypting that key with today's running Fernet key actually
    succeed? (would fail if the encryption secret changed since the key
    was saved, or if it was saved before the app's secret was ever set up)

Read-only. Does not change anything.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
import app.models.models  # noqa: F401 -- registers Store etc. before instagram models (which reference them) are queried
from app.instagram.models import AIProvider
from app.instagram.utils import decrypt_token


async def main():
    async with AsyncSessionLocal() as db:
        providers = (await db.execute(select(AIProvider))).scalars().all()
        if not providers:
            print("No rows at all in ai_providers -- the Settings page has never saved anything.")
            return

        any_active = False
        for p in providers:
            print(f"\nprovider={p.provider!r}  is_active={p.is_active}  model_name={p.model_name!r}  updated_at={p.updated_at}")
            if p.is_active:
                any_active = True
            if p.api_key_encrypted == "NOT_CONFIGURED" or not p.api_key_encrypted:
                print("  -> No key saved yet for this provider (still the placeholder).")
                continue
            try:
                key = decrypt_token(p.api_key_encrypted)
                masked = key[:6] + "..." + key[-4:] if len(key) > 12 else "(short value)"
                print(f"  -> Key decrypts fine: {masked}")
            except Exception as e:
                print(f"  -> KEY FAILS TO DECRYPT: {e!r}")
                print("     This means it was encrypted with a different secret than the one this "
                      "process is running with now (e.g. the app's encryption secret/env var changed "
                      "since this key was saved). ai_summary_service will silently treat this as "
                      "\"no key configured\" because of this exact failure.")

        print()
        if not any_active:
            print("NO PROVIDER IS MARKED ACTIVE.")
            print("ai_summary_service only ever reads the provider row where is_active=True — "
                  "if you saved a new key but never flipped its toggle to Active (or a different "
                  "provider is the active one), the AI Summary will always say \"no key detected\" "
                  "regardless of what key is saved. Go to Settings -> AI Provider Configuration and "
                  "make sure the provider you just updated shows \"Active\", not \"Inactive\".")
        else:
            active = [p for p in providers if p.is_active][0]
            print(f"Active provider is {active.provider!r}. If the AI Summary still says \"no key "
                  f"detected\", check the decrypt result for {active.provider!r} above.")


if __name__ == "__main__":
    asyncio.run(main())
