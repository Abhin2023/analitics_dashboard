#!/usr/bin/env python3
"""Applies a hand-verified batch of merge/confirm decisions for this specific
production cleanup — every pair below was checked against the real names
shown in the live output, not auto-matched by fuzzy word overlap (which is
what produced the errors caught before this was written: e.g. routing
"Sharaf Muscat Grand Mall SIS" to "MCC SIS" instead of "MGM SIS", or
confirming "FIORTUBE...CLT" as a brand new branch instead of merging it
into "Calicut").

Deliberately excludes anything not fully confirmed:
  - Two Sharaf SIS branches whose correct target ("MOO SIS", "MGM SIS")
    needs confirming still exist under those names.
  - "Shalom - John...Kodumbakkom" — needs the real Kodambakkam branch name.
  - "HAPPY BABY - AUH" and "The Sowers Group - Vashi Navi Mumbai" — medium/
    low confidence on their real match, left for manual review.
  - "Test shop Qatar" and "Shop" — flagged as unwanted; handle via
    delete_unwanted_stores.py separately, not here.
  - "Test shop BP", "Test shop Dubai", "KANLEE INNOVATIONS HO" — worth a
    quick gut-check before confirming as real, left out of this batch.

Prints its plan and asks for one confirmation before changing anything.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.models import Store
from app.services.store_merge_service import merge_store_into

# (source branch name exactly as shown in Branch Assignment, target branch name)
VERIFIED_MERGES = [
    ("AI STORE - Palakkad", "Palakkad"),
    ("Cell Tech Mobiles PAT", "PAT"),
    ("Genesis Growth Partners - Kannur", "Kannur"),
    ("Heavenly Treasure - Velachery", "Velachery"),
    ("Johns Imperium Pvt Ltd - Thrissur", "Thrissur"),
    ("Proshield Mysore", "Mysore"),
    ("Beapro Innovations - Delhi", "Delhi"),
    ("Graceful Ventures - Kukatpally", "Hyderabad - Kukatpally"),
    ("L&E Ventures - Wayanad", "Wayanad"),
    ("ONESHIELD PRIVATE LIMITED - Kochi", "Kochi"),
    ("Proshield Mangalore", "Mangalore City"),
    ("The Beloved Group - Korum Mall Mumbai", "Mumbai - Korum Mall"),
    ("The Favored Group - Bandra Mumbai", "Mumbai - Bandra"),
    ("Sharaf Muscat City Center SIS", "MCC SIS"),
    ("Sharaf DG Sohar Safeer SIS", "Sohar SIS"),
    ("ASIA PALACE MOBILE PHONES LLC", "Asia Palace"),
    ("Asia Mobile Phone L.L.C Br (ALN)", "Asia Mobile"),
    ("Landmark Trading Br 2", "Landmark - WTC"),
    ("Right View Trading LLC - AUH MALL", "AUH Mall"),
    ("Right View Trading LLC - Ajman", "Ajman"),
    ("Speedy Technical service Dubai Mall", "Speedy"),
    ("Speedy Technical Services Al Qusais", "Speedy"),
    ("Beefurb Technologies LLC - Karama", "Beefurb - Karama"),
    ("Speedy Technical Services Al Ghurair", "Speedy"),
    ("MAY INNOVATIONS - Marathahalli", "Bangalore - Marathahalli"),
    ("PEAPRO INNOVATIONS - Delhi", "Delhi"),
    ("Asair - Kannur", "Kannur"),
    ("Beefurb Technologies - Sharjah CC", "Beefurb - Sharjah"),
    ("Landmark Trading", "Landmark - WTC"),
    ("Speedy Festival City", "Speedy"),
    ("Speedy Technical Services JBR Branch", "Speedy"),
    ("Shieldify Mangalore City", "Mangalore City"),
    ("Break Protection Mangalore", "Mangalore City"),
    ("Buzzcore Technologies - Kollam", "Kollam"),
    ("EL - ROHIM PRIVATE LIMITED - Coimbatore", "TN - Coimbatore"),
    ("Gajraj Tech Guard Solution - Guwahati", "Guwahati"),
    ("JW NANOTECH SDN BHD - Malaysia", "Malaysia"),
    ("FIORTUBE TECHNOLOGIES PRIVATE LIMITED - CLT", "Calicut"),
]

# These are genuinely new branches with no existing twin — safe to confirm.
VERIFIED_NEW = [
    "Right View Office",
    "Right View Trading LLC - Bawabat Mall",
    "SILVER NET SHBAIYA 10",
    "Trinity Alpha Trading LLC",
    "Himaya Trading and Services",
    "Sharaf DG Mall of Muscat IK",
    "Sharaf DG Oman Avenues Mall IK",
    "iMobile Stratford - UK",
    "Proton Synergy Trading WLL",
    "Cupertino Tech Electronics Trading Co LLC",
    "Extel mobile phone trading abudhabi branch 2",
]


async def main():
    async with AsyncSessionLocal() as db:
        by_name = {s.name: s for s in (await db.execute(select(Store))).scalars().all()}

        plan_merge, plan_confirm, plan_missing = [], [], []

        for source_name, target_name in VERIFIED_MERGES:
            source = by_name.get(source_name)
            target = by_name.get(target_name)
            if not source:
                plan_missing.append(f"source not found: {source_name!r}")
            elif not target:
                plan_missing.append(f"target not found: {target_name!r} (for merging {source_name!r})")
            else:
                plan_merge.append((source, target))

        for name in VERIFIED_NEW:
            store = by_name.get(name)
            if not store:
                plan_missing.append(f"not found: {name!r}")
            else:
                plan_confirm.append(store)

        print(f"{len(plan_merge)} verified merge(s):")
        for source, target in plan_merge:
            print(f"  MERGE  {source.name!r:55} -> {target.name!r}")

        print(f"\n{len(plan_confirm)} verified new branch confirmation(s):")
        for store in plan_confirm:
            print(f"  CONFIRM {store.name!r}")

        if plan_missing:
            print(f"\n{len(plan_missing)} item(s) COULD NOT BE MATCHED (names may differ from what's in the script) — skipped:")
            for m in plan_missing:
                print(f"  ?  {m}")

        if not plan_merge and not plan_confirm:
            print("\nNothing to apply.")
            return

        answer = input(f"\nApply {len(plan_merge)} merge(s) and {len(plan_confirm)} confirmation(s)? Type 'yes' to proceed: ").strip().lower()
        if answer != "yes":
            print("Aborted — nothing changed.")
            return

        for source, target in plan_merge:
            await merge_store_into(db, source, target)
        for store in plan_confirm:
            store.needs_review = False

        await db.commit()
        print(f"\nDone. Merged {len(plan_merge)}, confirmed {len(plan_confirm)} as new.")


if __name__ == "__main__":
    asyncio.run(main())
