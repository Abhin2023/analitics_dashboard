#!/usr/bin/env python3
"""Applies the client's branch-review decisions (from Branch_Verification_Review.docx)
to the live database.

For each reviewed branch, the client wrote a plain-text answer in the
"Decision" column (e.g. "KOCHI", "CALICUT", "MUMBAI KORUM MALL"). This script:

  1. Looks up every CONFIRMED (not needs_review) store currently in the
     database, and tries to match the client's answer against one of them
     (case/spacing/punctuation-insensitive, with a fuzzy fallback for minor
     typos like "PATANAMTHITTA" vs "Pathanamthitta").
  2. If a confident match is found -> proposes MERGING the reviewed branch
     into that confirmed store (its sales history moves over, the duplicate
     row is deleted).
  3. If no confident match is found -> proposes CONFIRMING the reviewed
     branch as a genuinely new branch (clears needs_review so its revenue
     starts counting; does NOT rename it or assign a Team Leader — that's
     a separate manual step afterward).
  4. Rows the client left BLANK are skipped and reported separately as
     still pending.

This is a DRY RUN by default: it only prints the plan. Nothing is changed
until you review the printed plan and type 'yes' at the prompt.
"""
import asyncio
import sys
import os
import re
import difflib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.models import Store
from app.services.store_merge_service import merge_store_into

# (branch name as it appears in the system, client's decision text or "" if blank)
DECISIONS = [
    ("ONESHIELD PRIVATE LIMITED - Kochi", "KOCHI"),
    ("FIORTUBE TECHNOLOGIES PRIVATE LIMITED - CLT", "CALICUT"),
    ("Graceful Ventures - Kukatpally", "KUKATPALLY"),
    ("Shalom - John Private Limited - Kodumbakkom", "KODUMBAKKOM"),
    ("Johns Imperium Pvt Ltd - Thrissur", "THRISSUR"),
    ("Heavenly Treasure - Velachery", "VELACHERY"),
    ("MAY INNOVATIONS - Marathahalli", "MARATHAHALLI"),
    ("EL - ROHIM PRIVATE LIMITED - Coimbatore", "COIMBATORE"),
    ("AI STORE - Palakkad", "PALAKKAD"),
    ("Genesis Growth Partners - Kannur", "KANNUR"),
    ("Buzzcore Technologies - Kollam", "KOLLAM"),
    ("Proshield Mangalore", "MANGALORE"),
    ("Shieldify Mangalore City", ""),
    ("The Beloved Group - Korum Mall Mumbai", "MUMBAI KORUM MALL"),
    ("The Favored Group - Bandra Mumbai", "MUMBAI BANDRA"),
    ("Cell Tech Mobiles PAT", "PATANAMTHITTA"),
    ("Test shop BP", ""),
    ("Proshield Mysore", "MYSORE"),
    ("L&E Ventures - Wayanad", "WAYANAD"),
    ("Right View Trading LLC - Bawabat Mall", "BAWABAT MALL"),
    ("Beapro Innovations - Delhi", "DELHI"),
    ("Right View Trading LLC - Ajman", "AJMAN"),
    ("The Sowers Group - Vashi Navi Mumbai", "VASHI MUMBAI"),
    ("PEAPRO INNOVATIONS - Delhi", ""),
    ("Himaya Trading and Services", "QATAR"),
    ("Right View Trading LLC - AUH MALL", "AUH MALL"),
    ("ASIA PALACE MOBILE PHONES LLC", "ASIA PALACE"),
    ("Right View Office", "DUBAI OFFICE"),
    ("SILVER NET SHBAIYA 10", "SILVERNET"),
    ("Asia Mobile Phone L.L.C Br (ALN)", "ASIA MOBILE"),
    ("Beefurb Technologies LLC - Karama", "BEEFURB KARAMA"),
    ("Gajraj Tech Guard Solution - Guwahati", ""),
    ("Landmark Trading Br 2", ""),
    ("Landmark Trading", ""),
    ("Trinity Alpha Trading LLC", "BURJUMAN MALL"),
    ("HAPPY BABY - AUH", ""),
    ("Speedy Technical Services Al Ghurair", "SPEEDY"),
    ("Beefurb Technologies - Sharjah CC", "BEEFURB - SHARJAH"),
    ("Asair - Kannur", ""),
    ("Sharaf DG Oman Avenues Mall IK", ""),
    ("Speedy Technical Services Al Qusais", "SPEEDY"),
    ("Sharaf Muscat City Center SIS", "MCC SIS"),
    ("Sharaf Muscat Grand Mall SIS", "MGM SIS"),
    ("Sharaf DG Oman Mall SIS", "MOO SIS"),
    ("Speedy Technical service Dubai Mall", "SPEEDY"),
    ("KANLEE INNOVATIONS HO", ""),
    ("Sharaf DG Sohar Safeer SIS", "SOHAR SIS"),
    ("Sharaf DG Mall of Muscat IK", ""),
    ("JW NANOTECH SDN BHD - Malaysia", "MALAYSIA"),
    ("Break Protection Mangalore", ""),
    ("Proton Synergy Trading WLL", ""),
    ("Test shop Dubai", ""),
    ("Cupertino Tech Electronics Trading Co LLC", ""),
    ("Speedy Technical Services JBR Branch", "SPEEDY"),
    ("Shop", ""),
    ("Test shop Qatar", ""),
    ("iMobile Stratford - UK", ""),
    ("Speedy Festival City", "SPEEDY"),
    ("Extel mobile phone trading abudhabi branch 2", ""),
]

FUZZY_CUTOFF = 0.72


def norm(s: str) -> str:
    return re.sub(r"[^A-Z0-9]+", " ", s.upper()).strip()


def find_best_match(decision_norm: str, confirmed: list[tuple[Store, str]]):
    """Returns (store, score, reason) for the best confirmed-store match, or
    (None, 0, '') if nothing is close enough to trust automatically."""
    decision_words = set(decision_norm.split())

    best_store, best_score, best_reason = None, 0.0, ""
    for store, store_norm in confirmed:
        store_words = set(store_norm.split())
        if not store_words or not decision_words:
            continue
        # word containment either direction (handles "COIMBATORE" matching
        # "TN COIMBATORE", and "MUMBAI KORUM MALL" matching exactly)
        if decision_words <= store_words or store_words <= decision_words:
            overlap = len(decision_words & store_words) / max(len(decision_words), len(store_words))
            score = 0.9 + overlap * 0.1
            if score > best_score:
                best_store, best_score, best_reason = store, score, "word match"
                continue
        # fuzzy string similarity (catches typos like PATANAMTHITTA vs
        # PATHANAMTHITTA)
        ratio = difflib.SequenceMatcher(None, decision_norm, store_norm).ratio()
        if ratio > best_score:
            best_store, best_score, best_reason = store, ratio, "fuzzy match"

    if best_store and best_score >= FUZZY_CUTOFF:
        return best_store, best_score, best_reason
    return None, best_score, ""


async def main():
    async with AsyncSessionLocal() as db:
        all_stores = (await db.execute(select(Store))).scalars().all()
        by_name = {s.name: s for s in all_stores}
        confirmed = [(s, norm(s.name)) for s in all_stores if not s.needs_review]

        plan_merge = []   # (source_store, target_store, score, reason)
        plan_new = []     # (source_store,)
        plan_skip = []    # (branch_name,) - blank decision
        plan_notfound = []  # (branch_name, decision) - branch text didn't match any current store

        for branch_name, decision in DECISIONS:
            store = by_name.get(branch_name)
            if not store:
                plan_notfound.append((branch_name, decision))
                continue
            if not decision.strip():
                plan_skip.append(branch_name)
                continue
            match, score, reason = find_best_match(norm(decision), confirmed)
            if match and match.id != store.id:
                plan_merge.append((store, match, score, reason))
            else:
                plan_new.append(store)

        print(f"=== PLAN (dry run — nothing changed yet) ===\n")

        print(f"{len(plan_merge)} branch(es) will be MERGED into an existing confirmed branch:")
        for source, target, score, reason in plan_merge:
            print(f"  MERGE  id={source.id:5} {source.name!r:55} -> id={target.id:5} {target.name!r}  ({reason}, confidence={score:.2f})")

        print(f"\n{len(plan_new)} branch(es) will be CONFIRMED AS NEW (needs_review cleared, name/TL unchanged):")
        for source in plan_new:
            print(f"  CONFIRM id={source.id:5} {source.name!r}")

        if plan_notfound:
            print(f"\n{len(plan_notfound)} branch(es) from the document were NOT found in the current database "
                  f"(may have been renamed/merged already) — skipped:")
            for name, decision in plan_notfound:
                print(f"  ?  {name!r}  (decision was: {decision!r})")

        if plan_skip:
            print(f"\n{len(plan_skip)} branch(es) still have NO decision (left blank in the document) — left untouched:")
            for name in plan_skip:
                print(f"  -  {name!r}")

        if not plan_merge and not plan_new:
            print("\nNothing to apply.")
            return

        answer = input(f"\nApply {len(plan_merge)} merge(s) and {len(plan_new)} confirmation(s)? Type 'yes' to proceed: ").strip().lower()
        if answer != "yes":
            print("Aborted — nothing changed.")
            return

        for source, target, score, reason in plan_merge:
            await merge_store_into(db, source, target)

        for source in plan_new:
            source.needs_review = False

        await db.commit()
        print(f"\nDone. Merged {len(plan_merge)} branch(es), confirmed {len(plan_new)} as new.")


if __name__ == "__main__":
    asyncio.run(main())
