import logging
import re
import json
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

ANTHROPIC_BASE = "https://api.anthropic.com/v1"
OPENAI_BASE = "https://api.openai.com/v1"


class AIResponse:
    def __init__(self, text: str, input_tokens: int, output_tokens: int, model: str):
        self.text = text
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.model = model


def parse_intent_from_response(text: str) -> tuple[str, dict | None]:
    match = re.search(r"<intent>\s*(.*?)\s*</intent>", text, re.DOTALL)
    if match:
        clean_text = text[:match.start()].strip()
        try:
            intent = json.loads(match.group(1))
            return clean_text, intent
        except json.JSONDecodeError:
            return clean_text, None
    return text, None


def build_form_aware_prompt(base_prompt: str, active_forms: list[dict]) -> str:
    if not active_forms:
        return base_prompt

    form_list = "\n".join([
        f"- {f['name']}: {f['ai_prompt_hint']} (fields: {', '.join(f['field_keys'])})"
        for f in active_forms
    ])

    form_instructions = f"""

You have access to these forms that you can trigger when appropriate:

{form_list}

When a user message clearly indicates they need one of these forms, you MUST respond with BOTH:
1. A natural, helpful conversational response
2. A structured intent block wrapped in <intent> tags

Example format:
I'd be happy to help you file a complaint. Let me take your details.

<intent>
{{"trigger_form": "complaint", "confidence": 0.9, "pre_filled": {{"complaint": "user's issue summarized"}}}}
</intent>

Rules:
- Only trigger forms that are listed above
- Set confidence between 0.0 and 1.0 (only trigger if confidence > 0.7)
- Pre-fill fields when the user has already provided that information in their message
- If no form matches, respond normally WITHOUT the intent block
- Keep your conversational response warm and helpful
- For forms with fields already provided by the user, include them in pre_filled
"""
    return base_prompt + form_instructions


class ClaudeProvider:
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6"):
        self.api_key = api_key
        self.model = model
        self.client = httpx.AsyncClient(timeout=60.0)

    async def generate(self, messages: list[dict], system_prompt: str, max_tokens: int = 1024) -> AIResponse:
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })
        try:
            resp = await self.client.post(
                f"{ANTHROPIC_BASE}/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "system": system_prompt,
                    "messages": formatted_messages,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            text = data.get("content", [{}])[0].get("text", "")
            usage = data.get("usage", {})
            return AIResponse(
                text=text,
                input_tokens=usage.get("input_tokens", 0),
                output_tokens=usage.get("output_tokens", 0),
                model=self.model,
            )
        except Exception as e:
            logger.error("Claude API error: %s", e)
            return AIResponse(text="", input_tokens=0, output_tokens=0, model=self.model)

    async def close(self):
        await self.client.aclose()


class OpenAIProvider:
    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self.api_key = api_key
        self.model = model
        self.client = httpx.AsyncClient(timeout=60.0)

    async def generate(self, messages: list[dict], system_prompt: str, max_tokens: int = 1024) -> AIResponse:
        formatted_messages = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            formatted_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })
        try:
            resp = await self.client.post(
                f"{OPENAI_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": formatted_messages,
                    "max_tokens": max_tokens,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            return AIResponse(
                text=text,
                input_tokens=usage.get("prompt_tokens", 0),
                output_tokens=usage.get("completion_tokens", 0),
                model=self.model,
            )
        except Exception as e:
            logger.error("OpenAI API error: %s", e)
            return AIResponse(text="", input_tokens=0, output_tokens=0, model=self.model)

    async def close(self):
        await self.client.aclose()


class AIService:
    def __init__(self):
        self._providers: dict[str, object] = {}

    def _get_provider(self, provider_name: str, api_key: str, model: str):
        if provider_name == "claude":
            return ClaudeProvider(api_key=api_key, model=model or "claude-sonnet-4-6")
        elif provider_name == "openai":
            return OpenAIProvider(api_key=api_key, model=model or "gpt-4o")
        raise ValueError(f"Unknown provider: {provider_name}")

    async def generate_response(
        self,
        messages: list[dict],
        system_prompt: str,
        provider_name: str,
        api_key: str,
        model: str = "",
    ) -> AIResponse:
        provider = self._get_provider(provider_name, api_key, model)
        try:
            result = await provider.generate(messages, system_prompt)
            return result
        finally:
            await provider.close()

    def estimate_cost(self, provider: str, input_tokens: int, output_tokens: int) -> float:
        rates = {
            "claude": {"input": 3.0 / 1_000_000, "output": 15.0 / 1_000_000},
            "openai": {"input": 2.5 / 1_000_000, "output": 10.0 / 1_000_000},
        }
        r = rates.get(provider, rates["openai"])
        return input_tokens * r["input"] + output_tokens * r["output"]


ai_service = AIService()
