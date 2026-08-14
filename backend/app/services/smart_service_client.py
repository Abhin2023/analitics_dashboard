import logging
import httpx
from ..core.config import settings

logger = logging.getLogger(__name__)


class SmartServiceClient:
    def __init__(self):
        self.base_url = settings.SMARTSERVICE_MCP_URL

    async def health_check(self) -> dict:
        # TODO: needs API key to authenticate
        logger.info("SmartService health check - stub (no API key)")
        return {"status": "stub", "message": "SmartService integration not yet configured"}

    async def send_request(self, endpoint: str, data: dict = None) -> dict:
        # TODO: needs API key to authenticate
        logger.info(f"SmartService request to {endpoint} - stub (no API key)")
        return {"status": "stub", "message": "SmartService integration not yet configured"}


smart_service = SmartServiceClient()
