import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://graph.instagram.com/v23.0"


class InstagramGraphClient:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.client = httpx.AsyncClient(timeout=30.0)

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        url = f"{BASE_URL}{path}"
        params = kwargs.pop("params", {})
        params["access_token"] = self.access_token
        try:
            resp = await self.client.request(method, url, params=params, **kwargs)
            if resp.status_code == 429:
                logger.warning("Instagram rate limit hit on %s", path)
                return {"error": "rate_limited", "retry_after": resp.headers.get("Retry-After", 60)}
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            logger.error("Instagram API error %s: %s", path, e.response.text)
            return {"error": str(e), "status": e.response.status_code}
        except Exception as e:
            logger.error("Instagram API exception %s: %s", path, e)
            return {"error": str(e)}

    async def send_text_message(self, recipient_id: str, text: str) -> dict:
        return await self._request("POST", "/me/messages", json={
            "recipient": {"id": recipient_id},
            "message": {"text": text},
        })

    async def send_quick_replies(self, recipient_id: str, text: str, quick_replies: list[dict]) -> dict:
        return await self._request("POST", "/me/messages", json={
            "recipient": {"id": recipient_id},
            "message": {
                "text": text,
                "quick_replies": [
                    {
                        "content_type": "text",
                        "title": qr["title"][:20],
                        "payload": qr.get("payload", qr["title"]),
                    }
                    for qr in quick_replies[:13]
                ],
            },
        })

    async def send_button_template(self, recipient_id: str, text: str, buttons: list[dict]) -> dict:
        return await self._request("POST", "/me/messages", json={
            "recipient": {"id": recipient_id},
            "message": {
                "attachment": {
                    "type": "template",
                    "payload": {
                        "template_type": "button",
                        "text": text,
                        "buttons": buttons[:3],
                    },
                },
            },
        })

    async def send_private_reply(self, comment_id: str, text: str) -> dict:
        return await self._request("POST", f"/{comment_id}/private_replies", json={
            "message": {"text": text},
        })

    async def reply_to_comment(self, comment_id: str, text: str) -> dict:
        return await self._request("POST", f"/{comment_id}/replies", json={
            "message": {"text": text},
        })

    async def hide_comment(self, comment_id: str) -> dict:
        return await self._request("POST", f"/{comment_id}", params={"hidden": "true"})

    async def unhide_comment(self, comment_id: str) -> dict:
        return await self._request("POST", f"/{comment_id}", params={"hidden": "false"})

    async def delete_comment(self, comment_id: str) -> dict:
        return await self._request("DELETE", f"/{comment_id}")

    async def set_typing_indicator(self, recipient_id: str) -> dict:
        return await self._request("POST", "/me/messages", json={
            "recipient": {"id": recipient_id},
            "sender_action": "typing_on",
        })

    async def mark_seen(self, recipient_id: str) -> dict:
        return await self._request("POST", "/me/messages", json={
            "recipient": {"id": recipient_id},
            "sender_action": "mark_seen",
        })

    async def get_media_comments(self, media_id: str, limit: int = 50) -> dict:
        return await self._request("GET", f"/{media_id}/comments", params={
            "fields": "id,text,username,timestamp",
            "limit": str(limit),
        })

    async def get_media_list(self, limit: int = 25) -> dict:
        return await self._request("GET", "/me/media", params={
            "fields": "id,caption,media_type,media_url,timestamp,comments_count",
            "limit": str(limit),
        })

    async def get_conversations(self, limit: int = 25) -> dict:
        return await self._request("GET", "/me/conversations", params={
            "platform": "instagram",
            "fields": "id,participants,messages{from,id,message,created_time},message_count",
            "limit": str(limit),
        })

    async def get_messages(self, conversation_id: str, limit: int = 20) -> dict:
        return await self._request("GET", f"/{conversation_id}/messages", params={
            "fields": "id,from,message,created_time,attachments",
            "limit": str(limit),
        })

    async def get_user_profile(self, user_id: str) -> dict:
        return await self._request("GET", f"/{user_id}", params={
            "fields": "id,username,name,profile_picture_url",
        })

    async def close(self):
        await self.client.aclose()
