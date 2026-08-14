"""Seed CEO Dashboard data from india-ceo-dashboard-v4.html"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import AsyncSessionLocal
from app.models.models import (
    MarketingMetrics, StoreStaff, InternationalStore, StrategicInsight, Store, User
)
from sqlalchemy import select


# ══════════════════════════════════════════════════════════════
# Marketing Data (from mktData in HTML)
# ══════════════════════════════════════════════════════════════
MARKETING_DATA = [
    {"store": "Kerala Kochi", "tl": "MICHAEL", "ig_videos": 1, "ig_views": 144000, "ig_followers": 40, "ig_new_followers": 0, "ig_likes": 0, "ig_comments": 0, "ig_dms": 0, "ig_manychat": 0, "ig_posts": 4, "wa_walkins": 99, "g_rating": 4.4, "g_new_rev": 307, "rev_resp": "Partial"},
    {"store": "Kerala Trivandrum", "tl": "MICHAEL", "ig_videos": 0, "ig_views": 0, "ig_followers": 9, "ig_new_followers": 0, "ig_likes": 0, "ig_comments": 0, "ig_dms": 0, "ig_manychat": 0, "ig_posts": 2, "wa_walkins": 75, "g_rating": 4.0, "g_new_rev": 114, "rev_resp": "Partial"},
    {"store": "Kerala Thrissur", "tl": "SAM", "ig_videos": 1, "ig_views": 513000, "ig_followers": 323, "ig_new_followers": 0, "ig_likes": 0, "ig_comments": 0, "ig_dms": 0, "ig_manychat": 0, "ig_posts": 5, "wa_walkins": 61, "g_rating": 4.0, "g_new_rev": 48, "rev_resp": "Partial"},
    {"store": "Kerala Kannur", "tl": "SAM", "ig_videos": None, "ig_views": None, "ig_followers": None, "ig_new_followers": None, "ig_likes": None, "ig_comments": None, "ig_dms": None, "ig_manychat": None, "ig_posts": None, "wa_walkins": 35, "g_rating": 4.4, "g_new_rev": 67, "rev_resp": "Partial"},
    {"store": "Kerala Calicut", "tl": "MICHAEL", "ig_videos": None, "ig_views": None, "ig_followers": None, "ig_new_followers": None, "ig_likes": None, "ig_comments": None, "ig_dms": None, "ig_manychat": None, "ig_posts": None, "wa_walkins": 64, "g_rating": 4.4, "g_new_rev": 178, "rev_resp": "Partial"},
    {"store": "Mumbai Korum", "tl": "ABDULLAH", "ig_videos": None, "ig_views": None, "ig_followers": None, "ig_new_followers": None, "ig_likes": None, "ig_comments": None, "ig_dms": None, "ig_manychat": None, "ig_posts": None, "wa_walkins": 19, "g_rating": 4.8, "g_new_rev": 41, "rev_resp": "Partial"},
    {"store": "Bangalore Marathahalli", "tl": "NAZIL", "ig_videos": None, "ig_views": None, "ig_followers": None, "ig_new_followers": None, "ig_likes": None, "ig_comments": None, "ig_dms": None, "ig_manychat": None, "ig_posts": None, "wa_walkins": 80, "g_rating": 4.7, "g_new_rev": 81, "rev_resp": "Partial"},
    {"store": "Mangalore", "tl": "DEVIAHH", "ig_videos": 5, "ig_views": 600400, "ig_followers": 129, "ig_new_followers": 0, "ig_likes": 0, "ig_comments": 0, "ig_dms": 0, "ig_manychat": 2, "ig_posts": 9, "wa_walkins": 37, "g_rating": 4.2, "g_new_rev": 42, "rev_resp": "Partial"},
    {"store": "Bangalore Indiranagar", "tl": "NAZIL", "ig_videos": 0, "ig_views": 0, "ig_followers": 2, "ig_new_followers": 0, "ig_likes": 0, "ig_comments": 0, "ig_dms": 0, "ig_manychat": 0, "ig_posts": 3, "wa_walkins": 148, "g_rating": 4.3, "g_new_rev": 271, "rev_resp": "Partial"},
    {"store": "Chennai Kodambakam", "tl": "SAM", "ig_videos": 6, "ig_views": 6390000, "ig_followers": 6717, "ig_new_followers": 292, "ig_likes": 22, "ig_comments": 208, "ig_dms": 225, "ig_manychat": 152, "ig_posts": 9, "wa_walkins": 47, "g_rating": 4.4, "g_new_rev": 54, "rev_resp": "Partial"},
    {"store": "Chennai Velachery", "tl": "SAM", "ig_videos": None, "ig_views": None, "ig_followers": None, "ig_new_followers": None, "ig_likes": None, "ig_comments": None, "ig_dms": None, "ig_manychat": None, "ig_posts": None, "wa_walkins": 63, "g_rating": 4.5, "g_new_rev": 8, "rev_resp": "Yes"},
    {"store": "Mumbai Bandra", "tl": "ABDULLAH", "ig_videos": 4, "ig_views": 409900, "ig_followers": 32, "ig_new_followers": 2, "ig_likes": 2, "ig_comments": 24, "ig_dms": 20, "ig_manychat": 0, "ig_posts": 5, "wa_walkins": 5, "g_rating": 4.3, "g_new_rev": 19, "rev_resp": "Yes"},
    {"store": "Kerala Palakkad", "tl": "MICHAEL", "ig_videos": None, "ig_views": None, "ig_followers": None, "ig_new_followers": None, "ig_likes": None, "ig_comments": None, "ig_dms": None, "ig_manychat": None, "ig_posts": None, "wa_walkins": 23, "g_rating": 4.4, "g_new_rev": 35, "rev_resp": "Yes"},
    {"store": "Delhi Lajpat Nagar", "tl": "ABDULLAH", "ig_videos": None, "ig_views": None, "ig_followers": None, "ig_new_followers": None, "ig_likes": None, "ig_comments": None, "ig_dms": None, "ig_manychat": None, "ig_posts": None, "wa_walkins": 0, "g_rating": 4.7, "g_new_rev": 29, "rev_resp": "No"},
    {"store": "Guwahati", "tl": "HARSH", "ig_videos": 9, "ig_views": 1940000, "ig_followers": 1161, "ig_new_followers": 345, "ig_likes": 60, "ig_comments": 236, "ig_dms": 138, "ig_manychat": 12, "ig_posts": 19, "wa_walkins": 34, "g_rating": 4.6, "g_new_rev": 34, "rev_resp": "No"},
    {"store": "Kerala Pathanamthitta", "tl": "MICHAEL", "ig_videos": None, "ig_views": None, "ig_followers": None, "ig_new_followers": None, "ig_likes": None, "ig_comments": None, "ig_dms": None, "ig_manychat": None, "ig_posts": None, "wa_walkins": 1, "g_rating": 4.7, "g_new_rev": 26, "rev_resp": "No"},
    {"store": "Hyderabad Kukatpally", "tl": "ABDULLAH", "ig_videos": 5, "ig_views": 2260000, "ig_followers": 3062, "ig_new_followers": 97, "ig_likes": 27, "ig_comments": 116, "ig_dms": 79, "ig_manychat": 10, "ig_posts": 8, "wa_walkins": 110, "g_rating": 4.5, "g_new_rev": 83, "rev_resp": "Partial"},
    {"store": "Hyderabad Hitech", "tl": "ABDULLAH", "ig_videos": None, "ig_views": None, "ig_followers": None, "ig_new_followers": None, "ig_likes": None, "ig_comments": None, "ig_dms": None, "ig_manychat": None, "ig_posts": None, "wa_walkins": 100, "g_rating": 4.5, "g_new_rev": 43, "rev_resp": "Yes"},
    {"store": "Tn Coimbatore", "tl": "SAM", "ig_videos": 1, "ig_views": 9615, "ig_followers": 104, "ig_new_followers": 0, "ig_likes": 0, "ig_comments": 0, "ig_dms": 0, "ig_manychat": 0, "ig_posts": 4, "wa_walkins": 59, "g_rating": 4.1, "g_new_rev": 36, "rev_resp": "Yes"},
    {"store": "Kerala Kasargod", "tl": "MICHAEL", "ig_videos": 0, "ig_views": 0, "ig_followers": 5, "ig_new_followers": 0, "ig_likes": 0, "ig_comments": 0, "ig_dms": 0, "ig_manychat": 0, "ig_posts": 1, "wa_walkins": 59, "g_rating": 4.5, "g_new_rev": 31, "rev_resp": "Partial"},
    {"store": "Kerala Kollam", "tl": "MICHAEL", "ig_videos": None, "ig_views": None, "ig_followers": None, "ig_new_followers": None, "ig_likes": None, "ig_comments": None, "ig_dms": None, "ig_manychat": None, "ig_posts": None, "wa_walkins": 68, "g_rating": 4.0, "g_new_rev": 65, "rev_resp": "Yes"},
    {"store": "Mysore", "tl": "DEVIAHH", "ig_videos": 4, "ig_views": 642000, "ig_followers": 122, "ig_new_followers": 0, "ig_likes": 0, "ig_comments": 0, "ig_dms": 3, "ig_manychat": 0, "ig_posts": 6, "wa_walkins": 29, "g_rating": 5.0, "g_new_rev": 20, "rev_resp": "Yes"},
    {"store": "Kerala Kottkal", "tl": "MICHAEL", "ig_videos": 2, "ig_views": 741000, "ig_followers": 608, "ig_new_followers": 0, "ig_likes": 0, "ig_comments": 0, "ig_dms": 0, "ig_manychat": 7, "ig_posts": 5, "wa_walkins": 91, "g_rating": 4.8, "g_new_rev": 103, "rev_resp": "Partial"},
    {"store": "Kerala Wayanad", "tl": "MICHAEL", "ig_videos": 1, "ig_views": 385000, "ig_followers": 982, "ig_new_followers": 282, "ig_likes": 4, "ig_comments": 69, "ig_dms": 22, "ig_manychat": 2, "ig_posts": 4, "wa_walkins": 80, "g_rating": 4.9, "g_new_rev": 10, "rev_resp": "No"},
]

# ══════════════════════════════════════════════════════════════
# People Data (from peopleData in HTML)
# ══════════════════════════════════════════════════════════════
PEOPLE_DATA = [
    {"store": "Kerala Kochi", "tl": "MICHAEL", "mgr": "PRANAV", "accom": False, "staff": 3, "total": 3, "res": 1, "train": False, "notes": "One staff leaving"},
    {"store": "Kerala Kottkal", "tl": "MICHAEL", "mgr": "KRISHNA", "accom": True, "staff": 2, "total": 2, "res": 0, "train": False, "notes": ""},
    {"store": "Kerala Calicut", "tl": "MICHAEL", "mgr": "MUHAMMED", "accom": True, "staff": 3, "total": 3, "res": 0, "train": False, "notes": ""},
    {"store": "Kerala Trivandrum", "tl": "MICHAEL", "mgr": "ANOOP", "accom": True, "staff": 2, "total": 2, "res": 1, "train": False, "notes": ""},
    {"store": "Kerala Palakkad", "tl": "MICHAEL", "mgr": "BIBIN", "accom": False, "staff": 1, "total": 1, "res": 0, "train": False, "notes": ""},
    {"store": "Kerala Kollam", "tl": "MICHAEL", "mgr": "ADWAITH", "accom": False, "staff": 1, "total": 1, "res": 1, "train": False, "notes": ""},
    {"store": "Kerala Kasargod", "tl": "MICHAEL", "mgr": "SANOOJ", "accom": True, "staff": 2, "total": 2, "res": 0, "train": False, "notes": ""},
    {"store": "Kerala Pathanamthitta", "tl": "MICHAEL", "mgr": "JEFZAL", "accom": False, "staff": 1, "total": 1, "res": 0, "train": False, "notes": ""},
    {"store": "Kerala Wayanad", "tl": "MICHAEL", "mgr": "RINSHAD", "accom": True, "staff": 2, "total": 2, "res": 0, "train": True, "notes": ""},
    {"store": "Kerala Kannur", "tl": "SAM", "mgr": "ASHWIN", "accom": True, "staff": 2, "total": 2, "res": 1, "train": True, "notes": "One more needed"},
    {"store": "Chennai Kodambakam", "tl": "SAM", "mgr": "RAJA", "accom": False, "staff": 2, "total": 2, "res": 0, "train": False, "notes": ""},
    {"store": "Tn Coimbatore", "tl": "SAM", "mgr": "ARUN", "accom": False, "staff": 2, "total": 2, "res": 0, "train": True, "notes": ""},
    {"store": "Chennai Velachery", "tl": "SAM", "mgr": "SANJAY", "accom": False, "staff": 2, "total": 2, "res": 0, "train": False, "notes": ""},
    {"store": "Kerala Thrissur", "tl": "SAM", "mgr": "RIYAS", "accom": False, "staff": 2, "total": 2, "res": 0, "train": False, "notes": ""},
    {"store": "Bangalore Indiranagar", "tl": "NAZIL", "mgr": "NAZIL", "accom": True, "staff": 3, "total": 3, "res": 0, "train": True, "notes": ""},
    {"store": "Bangalore Marathahalli", "tl": "NAZIL", "mgr": "RAFI", "accom": False, "staff": 2, "total": 3, "res": 0, "train": False, "notes": ""},
    {"store": "Hyderabad Kukatpally", "tl": "ABDULLAH", "mgr": "KHALID", "accom": True, "staff": 2, "total": 2, "res": 0, "train": True, "notes": ""},
    {"store": "Hyderabad Hitech", "tl": "ABDULLAH", "mgr": "SAFWAN", "accom": False, "staff": 2, "total": 2, "res": 0, "train": False, "notes": ""},
    {"store": "Delhi Lajpat Nagar", "tl": "ABDULLAH", "mgr": "RASHID", "accom": False, "staff": 1, "total": 1, "res": 1, "train": False, "notes": "Zero revenue - needs review"},
    {"store": "Mumbai Korum", "tl": "ABDULLAH", "mgr": "SHAIKH", "accom": False, "staff": 1, "total": 1, "res": 0, "train": True, "notes": ""},
    {"store": "Mumbai Bandra", "tl": "ABDULLAH", "mgr": "IMRAN", "accom": False, "staff": 1, "total": 1, "res": 0, "train": False, "notes": ""},
    {"store": "Guwahati", "tl": "HARSH", "mgr": "VIKRAM", "accom": True, "staff": 2, "total": 2, "res": 0, "train": False, "notes": ""},
    {"store": "Mangalore", "tl": "DEVIAHH", "mgr": "SURESH", "accom": False, "staff": 2, "total": 2, "res": 0, "train": False, "notes": ""},
    {"store": "Mysore", "tl": "DEVIAHH", "mgr": "RAGHU", "accom": False, "staff": 1, "total": 1, "res": 0, "train": False, "notes": ""},
]

# ══════════════════════════════════════════════════════════════
# International Stores
# ══════════════════════════════════════════════════════════════
INTL_DATA = [
    {"name": "Bawabat", "country": "UAE", "region": "AUH", "target": 60000, "actual": 32677},
    {"name": "AUH Mall", "country": "UAE", "region": "AUH", "target": 31000, "actual": 19175},
    {"name": "Asia Mobile", "country": "UAE", "region": "AUH", "target": 18000, "actual": 20139},
    {"name": "Asia Palace", "country": "UAE", "region": "AUH", "target": 23000, "actual": 10644},
    {"name": "Silvernet", "country": "UAE", "region": "AUH", "target": 23000, "actual": 7521},
    {"name": "Landmark WTC", "country": "UAE", "region": "AUH", "target": 15000, "actual": 0},
    {"name": "Landmark Shabiya", "country": "UAE", "region": "AUH", "target": 20000, "actual": 6093},
    {"name": "Ajman", "country": "UAE", "region": "DXB", "target": 50000, "actual": 25341},
    {"name": "Speedy", "country": "UAE", "region": "DXB", "target": 15000, "actual": 3448},
    {"name": "Befurb Sharjah", "country": "UAE", "region": "DXB", "target": 12500, "actual": 4009},
    {"name": "Befurb Karama", "country": "UAE", "region": "DXB", "target": 20000, "actual": 9764},
    {"name": "Online", "country": "UAE", "region": "DXB", "target": 20000, "actual": 7413},
    {"name": "Burjuman", "country": "UAE", "region": "DXB", "target": None, "actual": 3720},
    {"name": "OAM IK", "country": "Oman", "region": "OMN", "target": 40068, "actual": 13217},
    {"name": "MOM IK", "country": "Oman", "region": "OMN", "target": 16027, "actual": 8329},
    {"name": "MCC SIS", "country": "Oman", "region": "OMN", "target": 40068, "actual": 13169},
    {"name": "MOO SIS", "country": "Oman", "region": "OMN", "target": 40068, "actual": 8716},
    {"name": "MGM SIS", "country": "Oman", "region": "OMN", "target": 25043, "actual": 3530},
    {"name": "Sohar SIS", "country": "Oman", "region": "OMN", "target": 19032, "actual": 5776},
]

# ══════════════════════════════════════════════════════════════
# Strategic Insights
# ══════════════════════════════════════════════════════════════
INSIGHTS = [
    # Overview
    {"category": "critical", "title": "Delhi: Zero Revenue All Month", "desc": "Rs 0 revenue, Rs 0 walkins despite Rs 1L target. Store is open (4.7 Google rating) but generating nothing.", "action": "ABDULLAH: Site visit + decision by Jul 7", "section": "overview", "priority": "critical", "deadline": "Jul 7", "order": 1},
    {"category": "critical", "title": "Bandra: 14% / Korum: 18%", "desc": "Maharashtra stores are 2 of the 3 worst performers. Fundamental footfall problem.", "action": "ABDULLAH: Emergency review + WA/IG activation plan", "section": "overview", "priority": "critical", "deadline": "Jul 7", "order": 2},
    {"category": "warning", "title": "Guwahati: 138 DMs - Only 12 Handled via ManyChat", "desc": "Getting 138 DMs on Instagram but 91% go unautomated. ~126 potential customers lost monthly.", "action": "HARSH + Marketing Team: ManyChat config this week", "section": "overview", "priority": "high", "deadline": "Jul 5", "order": 3},
    {"category": "warning", "title": "NAZIL Team at 35% - Both Bangalore Stores Underperforming", "desc": "Indiranagar (37%) and Marathahalli (28%). WA is working - store conversion is not.", "action": "NAZIL: In-store conversion training priority", "section": "overview", "priority": "high", "deadline": "Jul 10", "order": 4},
    {"category": "good", "title": "MICHAEL Playbook Worth Replicating", "desc": "Kottakkal (72%), Calicut (84%), PAT (88%) all high performers. Common thread: strong WA walkin pipeline.", "action": "MICHAEL: Document and share WA conversion process", "section": "overview", "priority": "strategic", "deadline": "Jul 20", "order": 5},
    {"category": "info", "title": "10 Stores Not Reporting IG Data", "desc": "Cannot measure digital performance for nearly half the network.", "action": "All TLs: Enforce daily tracker fill by Jul 10", "section": "overview", "priority": "high", "deadline": "Jul 10", "order": 6},
    # Marketing
    {"category": "critical", "title": "ManyChat Utilisation Crisis - 4 Stores Losing Leads", "desc": "Guwahati 8.7%, Kukatpally 12.7%, Wayanad 9%, Bandra 0%. Hundreds of leads leaking.", "action": "Marketing: ManyChat audit + config for all 4 stores by Jul 10", "section": "marketing", "priority": "critical", "deadline": "Jul 10", "order": 1},
    {"category": "critical", "title": "10 Stores Not Reporting IG - Blind Spot", "desc": "Kannur, Calicut, Marathahalli, Velachery etc not reporting. Cannot measure ROI.", "action": "All TLs: Zero tolerance for blank trackers from Jul 1", "section": "marketing", "priority": "critical", "deadline": "Jul 10", "order": 2},
    {"category": "good", "title": "Kodambakam: Blueprint for Content Strategy", "desc": "6 videos, 63.9L views (639% target), 67.6% ManyChat. Complete content-to-conversion funnel.", "action": "Marketing: Kodambakam content playbook to distribute to all TLs", "section": "marketing", "priority": "strategic", "deadline": "Jul 25", "order": 3},
    # Reviews
    {"category": "good", "title": "Wayanad 4.9 Rating - Only 10 Reviews", "desc": "Extremely high quality but very few reviews. One bad review could tank rating.", "action": "MICHAEL: Wayanad WA review drive campaign", "section": "reviews", "priority": "high", "deadline": "Jul 20", "order": 1},
    {"category": "info", "title": "14 Stores on Partial Response", "desc": "Not responding to all reviews hurts local SEO ranking.", "action": "All TLs: Weekly review response as part of store routine", "section": "reviews", "priority": "strategic", "deadline": "Jul 31", "order": 2},
    # Actions
    {"category": "critical", "title": "Delhi: Zero Revenue All June", "desc": "Store exists but no sales all month despite 4.7 rating.", "action": "Physical site visit + decide: revive or close", "assigned_to": "ABDULLAH", "section": "actions", "priority": "critical", "deadline": "Jul 7", "order": 1},
    {"category": "critical", "title": "Guwahati ManyChat Crisis", "desc": "138 DMs, only 12 handled. 126 leads at risk.", "action": "Set up ManyChat automation this week", "assigned_to": "HARSH + Marketing", "section": "actions", "priority": "critical", "deadline": "Jul 5", "order": 2},
    {"category": "critical", "title": "Landmark WTC UAE - Zero Revenue", "desc": "AED 15,000 target, 0 revenue.", "action": "Physical check: is store open? Staff present?", "assigned_to": "UAE TL", "section": "actions", "priority": "critical", "deadline": "Jul 5", "order": 3},
    {"category": "high", "title": "NAZIL Both Stores Below 40%", "desc": "WA walkins high but sales at 37%+28%.", "action": "In-store mystery audit + demo quality review", "assigned_to": "NAZIL", "section": "actions", "priority": "high", "deadline": "Jul 12", "order": 4},
    {"category": "strategic", "title": "MICHAEL Playbook Documentation", "desc": "Best TL at 70% - methodology not documented.", "action": "Document WA walkin conversion process for all TLs", "assigned_to": "MICHAEL", "section": "actions", "priority": "strategic", "deadline": "Jul 20", "order": 5},
]


async def seed():
    async with AsyncSessionLocal() as db:
        month = "2026-06"

        # Get store name -> id mapping
        stores_result = await db.execute(select(Store))
        stores = {s.name: s.id for s in stores_result.scalars().all()}

        # Also create partial-match mapping
        stores_lower = {s.name.lower(): s.id for s in stores_result.scalars().all()}

        def find_store_id(name):
            if name in stores:
                return stores[name]
            name_lower = name.lower()
            if name_lower in stores_lower:
                return stores_lower[name_lower]
            for sname, sid in stores_lower.items():
                if name_lower in sname or sname in name_lower:
                    return sid
            return None

        # Seed Marketing Metrics
        mkt_count = 0
        for row in MARKETING_DATA:
            store_id = find_store_id(row["store"])
            if not store_id:
                print(f"  [SKIP] Marketing: store '{row['store']}' not found")
                continue
            existing = (await db.execute(
                select(MarketingMetrics).where(MarketingMetrics.store_id == store_id, MarketingMetrics.month == month)
            )).scalar_one_or_none()
            if existing:
                continue
            mm = MarketingMetrics(
                store_id=store_id, month=month,
                ig_videos_posted=row.get("ig_videos"),
                ig_views=row.get("ig_views"),
                ig_followers=row.get("ig_followers"),
                ig_new_followers=row.get("ig_new_followers"),
                ig_likes=row.get("ig_likes"),
                ig_comments=row.get("ig_comments"),
                ig_dms_received=row.get("ig_dms"),
                ig_manychat_handled=row.get("ig_manychat"),
                ig_posts=row.get("ig_posts"),
                wa_walkins=row.get("wa_walkins", 0),
                google_rating=row.get("g_rating"),
                google_new_reviews=row.get("g_new_rev"),
                google_review_response=row.get("rev_resp", ""),
            )
            db.add(mm)
            mkt_count += 1
        print(f"  Marketing: {mkt_count} records inserted")

        # Seed People/Staff
        staff_count = 0
        for row in PEOPLE_DATA:
            store_id = find_store_id(row["store"])
            if not store_id:
                print(f"  [SKIP] Staff: store '{row['store']}' not found")
                continue
            existing = (await db.execute(
                select(StoreStaff).where(StoreStaff.store_id == store_id, StoreStaff.month == month)
            )).scalar_one_or_none()
            if existing:
                continue
            ss = StoreStaff(
                store_id=store_id, month=month,
                manager_name=row.get("mgr", ""),
                staff_count=row.get("staff", 0),
                total_headcount=row.get("total", 0),
                has_accommodation=row.get("accom", False),
                resignation_risk=row.get("res", 0),
                training_active=row.get("train", False),
                notes=row.get("notes", ""),
            )
            db.add(ss)
            staff_count += 1
        print(f"  Staff: {staff_count} records inserted")

        # Seed International Stores
        intl_count = 0
        for row in INTL_DATA:
            existing = (await db.execute(
                select(InternationalStore).where(InternationalStore.name == row["name"], InternationalStore.month == month)
            )).scalar_one_or_none()
            if existing:
                continue
            ist = InternationalStore(
                name=row["name"], country=row["country"], region=row["region"],
                month=month, target=row.get("target"), actual=row.get("actual", 0),
            )
            db.add(ist)
            intl_count += 1
        print(f"  International: {intl_count} records inserted")

        # Seed Strategic Insights
        del_result = await db.execute(select(StrategicInsight).where(StrategicInsight.month == month))
        for e in del_result.scalars().all():
            await db.delete(e)

        ins_count = 0
        for row in INSIGHTS:
            insight = StrategicInsight(
                month=month,
                category=row["category"],
                title=row["title"],
                description=row["desc"],
                action_tag=row["action"],
                assigned_to=row.get("assigned_to", ""),
                section=row["section"],
                priority=row["priority"],
                deadline=row.get("deadline", ""),
                sort_order=row.get("order", 0),
            )
            db.add(insight)
            ins_count += 1
        print(f"  Insights: {ins_count} records inserted")

        await db.commit()
        print("\nDone! CEO Dashboard data seeded successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
