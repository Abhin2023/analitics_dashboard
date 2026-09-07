import logging
import json
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

ANTHROPIC_BASE = "https://api.anthropic.com/v1"
OPENAI_BASE = "https://api.openai.com/v1"


ROUTE_CONVERSATION_TOOL = {
    "name": "route_conversation",
    "description": (
        "Route the conversation to the correct action. "
        "You MUST call this tool exactly once per user message."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "sentiment": {
                "type": "string",
                "enum": ["positive", "neutral", "negative", "angry"],
                "description": "The user's sentiment in this message.",
            },
            "action": {
                "type": "string",
                "enum": ["trigger_form", "answer_faq", "general_reply"],
                "description": (
                    "Which action to take. Use 'trigger_form' when the user clearly "
                    "needs a structured data-collection flow. Use 'answer_faq' only "
                    "when the user's question matches a provided FAQ entry. Otherwise "
                    "use 'general_reply'."
                ),
            },
            "form_slug": {
                "type": "string",
                "description": (
                    "The slug of the form to trigger. Required when action is "
                    "'trigger_form'. Must be one of the slugs listed in the system "
                    "prompt. Leave empty or omit for other actions."
                ),
            },
            "confidence": {
                "type": "number",
                "description": "Self-reported confidence 0.0-1.0 for the chosen action.",
            },
            "reply_text": {
                "type": "string",
                "description": (
                    "The natural-language reply to send to the user. When action is "
                    "'trigger_form', this is a brief acknowledgment before the form "
                    "starts. When action is 'answer_faq', answer ONLY from the "
                    "injected FAQ context — never invent details. When action is "
                    "'general_reply', respond helpfully and concisely."
                ),
            },
        },
        "required": ["sentiment", "action", "confidence", "reply_text"],
    },
}


class AIResponse:
    def __init__(
        self,
        text: str,
        input_tokens: int,
        output_tokens: int,
        model: str,
        action: str = "general_reply",
        form_slug: str = "",
        sentiment: str = "neutral",
        confidence: float = 0.0,
        reply_text: str = "",
    ):
        self.text = text
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.model = model
        self.action = action
        self.form_slug = form_slug
        self.sentiment = sentiment
        self.confidence = confidence
        self.reply_text = reply_text


def build_system_prompt(
    base_prompt: str,
    active_forms: list[dict],
    active_faqs: list[dict],
    already_triggered_forms: list[str] | None = None,
) -> str:
    sections = [base_prompt]

    if active_forms:
        form_list = "\n".join(
            f"- slug=\"{f['slug']}\": {f['description']} "
            f"(collects: {', '.join(f['field_keys'])})"
            for f in active_forms
        )
        sections.append(
            f"\nAvailable forms (use the form_slug value exactly):\n{form_list}\n"
            f"\nRules for forms:\n"
            f"- Only trigger a form when the user clearly needs that data collected.\n"
            f"- Do NOT re-trigger a form the user has already completed or is in the "
            f"middle of — if the form slug appears in 'already_triggered_forms', do "
            f"not use action='trigger_form' for it unless the user explicitly asks to "
            f"start over.\n"
            f"- Set reply_text to a brief, warm acknowledgment before the form begins."
        )

    if active_faqs:
        faq_block = "\n\n".join(
            f"Q: {faq['question']}\nA: {faq['answer']}"
            for faq in active_faqs
        )
        sections.append(
            f"\nFAQ knowledge base — answer ONLY from these entries when action is "
            f"'answer_faq'. If no FAQ matches, use 'general_reply' and let a human "
            f"follow up.\n\n{faq_block}"
        )

    if already_triggered_forms:
        sections.append(
            f"\nForms already triggered in this conversation: "
            f"{', '.join(already_triggered_forms)}. Do not re-trigger these unless "
            f"the user explicitly requests it."
        )

    sections.append(
        "\nYou MUST call the route_conversation tool exactly once. "
        "Do not output any text outside the tool call."
    )

    return "\n".join(sections)


def _extract_tool_result(content_blocks: list[dict]) -> Optional[dict]:
    for block in content_blocks:
        if block.get("type") == "tool_use" and block.get("name") == "route_conversation":
            return block.get("input", {})
    return None


class ClaudeProvider:
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6"):
        self.api_key = api_key
        self.model = model
        self.client = httpx.AsyncClient(timeout=60.0)

    async def generate(
        self,
        messages: list[dict],
        system_prompt: str,
        max_tokens: int = 1024,
    ) -> AIResponse:
        formatted_messages = [
            {"role": msg.get("role", "user"), "content": msg.get("content", "")}
            for msg in messages
        ]
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
                    "tools": [ROUTE_CONVERSATION_TOOL],
                    "tool_choice": {
                        "type": "tool",
                        "name": "route_conversation",
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            usage = data.get("usage", {})
            input_tokens = usage.get("input_tokens", 0)
            output_tokens = usage.get("output_tokens", 0)

            content = data.get("content", [])
            tool_result = _extract_tool_result(content)

            if tool_result:
                return AIResponse(
                    text=tool_result.get("reply_text", ""),
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    model=self.model,
                    action=tool_result.get("action", "general_reply"),
                    form_slug=tool_result.get("form_slug", ""),
                    sentiment=tool_result.get("sentiment", "neutral"),
                    confidence=tool_result.get("confidence", 0.0),
                    reply_text=tool_result.get("reply_text", ""),
                )

            fallback_text = ""
            for block in content:
                if block.get("type") == "text":
                    fallback_text = block.get("text", "")
                    break
            return AIResponse(
                text=fallback_text,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                model=self.model,
            )
        except Exception as e:
            logger.error("Claude API error: %s", e)
            return AIResponse(
                text="", input_tokens=0, output_tokens=0, model=self.model
            )

    async def close(self):
        await self.client.aclose()


class OpenAIProvider:
    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self.api_key = api_key
        self.model = model
        self.client = httpx.AsyncClient(timeout=60.0)

    async def generate(
        self,
        messages: list[dict],
        system_prompt: str,
        max_tokens: int = 1024,
    ) -> AIResponse:
        formatted_messages = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            formatted_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })

        openai_tool = {
            "type": "function",
            "function": {
                "name": ROUTE_CONVERSATION_TOOL["name"],
                "description": ROUTE_CONVERSATION_TOOL["description"],
                "parameters": ROUTE_CONVERSATION_TOOL["input_schema"],
            },
        }

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
                    "tools": [openai_tool],
                    "tool_choice": {
                        "type": "function",
                        "function": {"name": "route_conversation"},
                    },
                    "max_tokens": max_tokens,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            usage = data.get("usage", {})
            input_tokens = usage.get("prompt_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0)

            choices = data.get("choices", [])
            if choices:
                message = choices[0].get("message", {})
                tool_calls = message.get("tool_calls", [])
                if tool_calls:
                    args_str = tool_calls[0].get("function", {}).get("arguments", "{}")
                    try:
                        tool_result = json.loads(args_str)
                    except json.JSONDecodeError:
                        tool_result = {}

                    return AIResponse(
                        text=tool_result.get("reply_text", ""),
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        model=self.model,
                        action=tool_result.get("action", "general_reply"),
                        form_slug=tool_result.get("form_slug", ""),
                        sentiment=tool_result.get("sentiment", "neutral"),
                        confidence=tool_result.get("confidence", 0.0),
                        reply_text=tool_result.get("reply_text", ""),
                    )

                fallback_text = message.get("content", "")
                return AIResponse(
                    text=fallback_text,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    model=self.model,
                )

            return AIResponse(
                text="", input_tokens=input_tokens,
                output_tokens=output_tokens, model=self.model,
            )
        except Exception as e:
            logger.error("OpenAI API error: %s", e)
            return AIResponse(
                text="", input_tokens=0, output_tokens=0, model=self.model
            )

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
            return await provider.generate(messages, system_prompt)
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
