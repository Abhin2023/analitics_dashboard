#!/usr/bin/env python3
"""Lists every branch still flagged needs_review that DOES have real sales
data attached (run this after cleanup_empty_review_stores.py has removed the
empty ones, so what's left here is exactly what needs a human decision).

For each one, prints its total revenue (so you know how much is currently
excluded from your dashboard totals) and a best-guess match against your
existing confirmed branches, based on shared words in the name — purely a
suggestion to speed up your review, never applied automatically. You decide,
for each row, whether to:
  - Merge it into the suggested (or a different) confirmed branch via the
    Branch Assignment page's "Merge into..." control, or
  - Assign it a real Team Leader and click "Confirm as new branch" if it's
    genuinely a new branch with no existing twin.

Read-only. Does not change anything.
"""
import asyncio
import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, func
from app.db.session import AsyncSessionLocal
from app.models.models import Store, McpDailySale

_STOPWORDS = {
    "pvt", "ltd", "private", "limited", "llc", "technologies", "technology",
    "innovations", "innovation", "trading", "group", "solutions", "solution",
    "the", "and", "co", "company", "enterprises", "ventures", "partners",
    "gadgets", "services", "service", "store", "shop", "sdn", "bhd",
    "mall", "branch", "br", "mobile", "phone", "phones", "office", "city",
}


def _words(name: str) -> set[str]:
    tokens = re.findall(r"[a-z]+", name.lower())
    return {t for t in tokens if t not in _STOPWORDS and len(t) > 2}


async def main():
    async with AsyncSessionLocal() as db:
        all_stores = (await db.execute(select(Store))).scalars().all()
        confirmed = [s for s in all_stores if not s.needs_review]
        review = [s for s in all_stores if s.needs_review]

        confirmed_words = [(s, _words(s.name)) for s in confirmed]

        rows = []
        for s in review:
            total = (await db.execute(
                select(func.sum(McpDailySale.revenue)).where(McpDailySale.store_id == s.id)
            )).scalar()
            total = float(total or 0)
            if total <= 0:
                continue  # zero-revenue ones are handled by cleanup_empty_review_stores.py

            my_words = _words(s.name)
            best, best_overlap = None, 0
            for cs, cw in confirmed_words:
                overlap = len(my_words & cw)
                if overlap > best_overlap:
                    best, best_overlap = cs, overlap

            rows.append((s, total, best, best_overlap))

        rows.sort(key=lambda r: -r[1])

        if not rows:
            print("No needs-review branches with real revenue remain. Nothing left to review.")
            return

        print(f"{len(rows)} needs-review branch(es) still hold real revenue "
              f"(currently excluded from your dashboard totals):\n")
        total_excluded = 0.0
        for s, total, best, overlap in rows:
            total_excluded += total
            suggestion = f"maybe same as: {best.name!r} (id={best.id})" if best and overlap > 0 else "no close match found — likely genuinely new"
            print(f"  id={s.id:5}  {s.name:50}  revenue={total:>14,.2f}  country={s.country:10}  -> {suggestion}")

        print(f"\nTotal revenue currently excluded from your dashboard due to needs_review: {total_excluded:,.2f}")
        print("\nNothing was changed. Review each row above, then either merge it into its "
              "match (if correct) or confirm it as new, via the Branch Assignment page.")


if __name__ == "__main__":
    asyncio.run(main())
