from fastapi import APIRouter
from pydantic import BaseModel
from ...core.logging_config import get_frontend_logger

router = APIRouter(prefix="/client-logs", tags=["client-logs"])


class ClientLogEntry(BaseModel):
    level: str = "error"
    message: str
    stack: str = ""
    url: str = ""
    user_agent: str = ""


@router.post("")
async def report_client_log(entry: ClientLogEntry):
    """Errors caught in the browser (uncaught exceptions, unhandled promise
    rejections, console.error calls) get forwarded here so they land in
    logs/frontend.log instead of only ever being visible in devtools.
    No auth required — errors can happen before login (e.g. on the login
    page itself).
    """
    logger = get_frontend_logger()
    line = f"{entry.message} | url={entry.url} | ua={entry.user_agent}"
    if entry.stack:
        line += f"\n{entry.stack}"
    getattr(logger, entry.level if entry.level in ("error", "warning", "info") else "error")(line)
    return {"status": "logged"}
