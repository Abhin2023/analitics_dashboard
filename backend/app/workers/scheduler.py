import logging
import os
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from ..services.sheet_sync_service import SheetSyncService

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def sync_all_sources():
    from ..db.session import AsyncSessionLocal
    from sqlalchemy import select, func
    from ..models.models import SheetSource, SheetSyncLog

    svc = SheetSyncService()
    now = datetime.utcnow()
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SheetSource).where(SheetSource.is_enabled == True))
        sources = result.scalars().all()

        due = []
        for src in sources:
            interval = src.sync_interval_minutes or 5
            last_q = await db.execute(
                select(func.max(SheetSyncLog.last_synced_at)).where(
                    SheetSyncLog.sheet_source_id == src.id
                )
            )
            last = last_q.scalar()
            if last is not None:
                if last.tzinfo is not None:
                    last = last.replace(tzinfo=None)
                if (now - last).total_seconds() < interval * 60:
                    continue
            due.append(src.id)

    for sid in due:
        logger.info(f"Syncing source: {sid}")
        async with AsyncSessionLocal() as db:
            await svc.sync_source(db, sid)


async def poll_instagram_comments():
    from ..db.session import AsyncSessionLocal
    from ..instagram.bot_engine import poll_and_process_comments

    try:
        async with AsyncSessionLocal() as db:
            await poll_and_process_comments(db)
            await db.commit()
    except Exception as e:
        logger.error("Instagram comment polling error: %s", e)


async def sync_tele_call_leads():
    from ..db.session import AsyncSessionLocal
    from ..services.tele_call_sync import sync_tele_call_leads as _sync

    try:
        async with AsyncSessionLocal() as db:
            await _sync(db)
    except Exception as e:
        logger.error("Tele call leads sync error: %s", e)


def start_scheduler():
    if os.getenv("ENABLE_SCHEDULER", "1") != "1":
        logger.info("Scheduler disabled via ENABLE_SCHEDULER=0")
        return

    scheduler.add_job(
        sync_all_sources,
        "interval",
        minutes=1,
        id="sheet_sync_all",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=600,
    )
    scheduler.add_job(
        poll_instagram_comments,
        "interval",
        minutes=15,
        id="instagram_comment_poll",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=600,
    )
    scheduler.add_job(
        sync_tele_call_leads,
        "interval",
        minutes=5,
        id="tele_call_leads_sync",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=600,
    )
    scheduler.start()
    logger.info("Scheduler started (sheet sync: 1min, tele call: 5min, Instagram poll: 15min)")
