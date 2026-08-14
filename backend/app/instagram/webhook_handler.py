import json
import logging
from fastapi import APIRouter, Request, Response, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..db.session import AsyncSessionLocal
from .utils import verify_webhook_signature, WEBHOOK_VERIFY_TOKEN
from .models import IGAccount
from .bot_engine import BotEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/instagram", tags=["instagram-webhook"])


@router.get("/webhook")
async def verify_webhook(request: Request):
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if mode == "subscribe" and token == WEBHOOK_VERIFY_TOKEN:
        return Response(content=challenge, media_type="text/plain")

    return Response(content="Verification failed", status_code=403)


@router.post("/webhook")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
    payload = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    if not verify_webhook_signature(payload, signature):
        return Response(content="Invalid signature", status_code=403)

    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return Response(content="Invalid JSON", status_code=400)

    if data.get("object") != "instagram":
        return Response(content="Not Instagram event", status_code=200)

    background_tasks.add_task(process_webhook_event, data)

    return Response(content="EVENT_RECEIVED", status_code=200)


async def process_webhook_event(data: dict):
    async with AsyncSessionLocal() as db:
        for entry in data.get("entry", []):
            ig_user_id = entry.get("id")

            account_result = await db.execute(
                select(IGAccount).where(IGAccount.ig_user_id == ig_user_id)
            )
            account = account_result.scalar_one_or_none()
            if not account:
                continue

            for messaging_event in entry.get("messaging", []):
                await _handle_messaging(db, account, messaging_event)

            for change in entry.get("changes", []):
                field = change.get("field")
                value = change.get("value", {})
                if field == "comments":
                    await _handle_comment_event(db, account, value)

        await db.commit()


async def _handle_messaging(db: AsyncSession, account: IGAccount, event: dict):
    sender = event.get("sender", {})
    sender_id = sender.get("id", "")
    message = event.get("message", {})

    if not sender_id or not message:
        return

    if message.get("is_echo"):
        return

    text = message.get("text", "")
    attachments = message.get("attachments", [])

    if not text and not attachments:
        return

    message_text = text
    if not message_text and attachments:
        message_text = f"[{attachments[0].get('type', 'media')}]"

    engine = BotEngine(db)
    await engine.handle_dm(
        ig_account=account,
        sender_id=sender_id,
        message_text=message_text,
    )


async def _handle_comment_event(db: AsyncSession, account: IGAccount, value: dict):
    comment_id = value.get("id", "")
    text = value.get("text", "")
    username = value.get("username", "")

    if not comment_id:
        return

    media_id = value.get("media_id", "")
    if not media_id:
        from .graph_client import InstagramGraphClient
        from .utils import decrypt_token
        token = decrypt_token(account.access_token_encrypted)
        client = InstagramGraphClient(token)
        try:
            parent_result = await client._request("GET", f"/{comment_id}", params={"fields": "id,media_id"})
            media_id = parent_result.get("media_id", "")
        finally:
            await client.close()

    engine = BotEngine(db)
    await engine.handle_comment(
        ig_account=account,
        media_id=media_id,
        comment_id=comment_id,
        username=username,
        text=text,
    )
