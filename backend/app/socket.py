import logging
import socketio
from .core.security import decode_token
from .core.config import settings

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.cors_origins_list,
    logger=False,
    engineio_logger=False,
)


@sio.event
async def connect(sid, environ, auth):
    token = auth.get("token") if auth else None
    if not token:
        raise socketio.exceptions.ConnectionRefusedError("Authentication required")
    payload = decode_token(token)
    if not payload:
        raise socketio.exceptions.ConnectionRefusedError("Invalid token")
    await sio.save_session(sid, {
        "user_id": payload.get("sub"),
        "role": payload.get("role"),
    })
    logger.info(f"[Socket.IO] Client connected: {sid}")


@sio.event
async def disconnect(sid):
    logger.info(f"[Socket.IO] Client disconnected: {sid}")
