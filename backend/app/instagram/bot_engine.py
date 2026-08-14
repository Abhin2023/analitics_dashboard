import logging
import re
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import IGAccount, IGConversation, IGMessage, IGBotSettings, AIProvider, AIUsageLog, IGComment, IGCommentRule
from .form_models import IGForm, IGFormField, IGFormSubmission
from .graph_client import InstagramGraphClient
from .ai_service import ai_service, parse_intent_from_response, build_form_aware_prompt
from .utils import decrypt_token
from ..models.models import Lead
from ..core.config import settings

logger = logging.getLogger(__name__)

LEAD_SIGNALS = [
    r"\b(price|pricing|cost|how much|rate|quote)\b",
    r"\b(buy|purchase|order|book|interested|want to buy)\b",
    r"\b(demo|trial|schedule|appointment|visit|come to store)\b",
    r"\b(delivery|shipping|available|stock|when)\b",
    r"\b(contact|phone|email|whatsapp|call me)\b",
]


class BotEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_active_provider(self) -> tuple[AIProvider, str] | None:
        result = await self.db.execute(
            select(AIProvider).where(AIProvider.is_active == True)
        )
        provider = result.scalar_one_or_none()
        if not provider:
            return None
        api_key = decrypt_token(provider.api_key_encrypted)
        return provider, api_key

    async def _get_active_forms(self, ig_account_id: int) -> list[dict]:
        result = await self.db.execute(
            select(IGForm).where(IGForm.ig_account_id == ig_account_id, IGForm.is_active == True)
        )
        forms = result.scalars().all()
        active_forms = []
        for form in forms:
            fields_result = await self.db.execute(
                select(IGFormField).where(IGFormField.form_id == form.id, IGFormField.phase == 1).order_by(IGFormField.sort_order)
            )
            fields = fields_result.scalars().all()
            active_forms.append({
                "name": form.name,
                "ai_prompt_hint": form.ai_prompt_hint,
                "field_keys": [f.field_key for f in fields],
            })
        return active_forms

    async def _get_active_submission(self, conversation_id: int) -> IGFormSubmission | None:
        result = await self.db.execute(
            select(IGFormSubmission).where(
                IGFormSubmission.conversation_id == conversation_id,
                IGFormSubmission.status == "partial",
            )
        )
        return result.scalar_one_or_none()

    async def _process_form_answer(self, conversation: IGConversation, message_text: str, client: InstagramGraphClient, sender_id: str):
        submission = await self._get_active_submission(conversation.id)
        if not submission:
            return False

        form_result = await self.db.execute(select(IGForm).where(IGForm.id == submission.form_id))
        form = form_result.scalar_one_or_none()
        if not form:
            return False

        phase1_fields_result = await self.db.execute(
            select(IGFormField).where(IGFormField.form_id == form.id, IGFormField.phase == 1).order_by(IGFormField.sort_order)
        )
        phase1_fields = phase1_fields_result.scalars().all()

        if submission.current_field_index >= len(phase1_fields):
            return False

        current_field = phase1_fields[submission.current_field_index]

        if submission.phase1_data is None:
            submission.phase1_data = {}
        submission.phase1_data[current_field.field_key] = message_text

        next_index = submission.current_field_index + 1
        remaining = [f for f in phase1_fields if f.sort_order > current_field.sort_order]

        if remaining:
            submission.current_field_index = next_index
            next_field = remaining[0]
            quick_replies = []
            if next_field.field_type == "phone":
                quick_replies = [{"title": "Use my phone", "payload": "USE_PHONE"}]
            elif next_field.field_type == "email":
                quick_replies = [{"title": "Use my email", "payload": "USE_EMAIL"}]

            if quick_replies:
                await client.send_quick_replies(sender_id, next_field.placeholder or f"Please provide your {next_field.label.lower()}:", quick_replies)
            else:
                await client.send_text_message(sender_id, next_field.placeholder or f"Please provide your {next_field.label.lower()}:")
        else:
            if form.form_type == "two_phase":
                submission.status = "partial"
                link = f"{settings.FRONTEND_URL}/ig-form/{form.id}/{submission.id}"
                await client.send_button_template(
                    sender_id,
                    f"Thank you! Your details are saved. Please complete your {form.display_name.lower()} by selecting your options:",
                    [{"type": "web_url", "title": "Complete Booking", "url": link}],
                )
            else:
                submission.status = "completed"
                await client.send_text_message(sender_id, form.success_message)
                await self._create_lead_from_submission(submission, conversation)

        await self.db.flush()
        return True

    async def _create_lead_from_submission(self, submission: IGFormSubmission, conversation: IGConversation):
        data = submission.phase1_data or {}
        name = data.get("name", conversation.customer_name or conversation.ig_user_id)
        phone = data.get("phone", "")

        lead = Lead(
            store_id=None,
            source="instagram",
            name=name,
            phone=phone,
            status="warm",
            stage="new",
        )
        self.db.add(lead)
        await self.db.flush()
        submission.lead_id = lead.id
        conversation.lead_id = lead.id
        await self.db.flush()

    async def _start_form(self, form: IGForm, conversation: IGConversation, client: InstagramGraphClient, sender_id: str, pre_filled: dict = None):
        phase1_fields_result = await self.db.execute(
            select(IGFormField).where(IGFormField.form_id == form.id, IGFormField.phase == 1).order_by(IGFormField.sort_order)
        )
        phase1_fields = phase1_fields_result.scalars().all()
        if not phase1_fields:
            return

        submission = IGFormSubmission(
            form_id=form.id,
            conversation_id=conversation.id,
            ig_user_id=sender_id,
            phase1_data=pre_filled or {},
            status="partial",
            current_field_index=0,
        )
        self.db.add(submission)
        await self.db.flush()

        if pre_filled:
            filled_keys = set(pre_filled.keys())
            for i, field in enumerate(phase1_fields):
                if field.field_key not in filled_keys:
                    submission.current_field_index = i
                    break
            else:
                submission.status = "completed" if form.form_type == "simple" else "partial"
                if form.form_type == "two_phase":
                    link = f"{settings.FRONTEND_URL}/ig-form/{form.id}/{submission.id}"
                    await client.send_button_template(
                        sender_id,
                        f"Thank you! Your details are saved. Please complete your {form.display_name.lower()} by selecting your options:",
                        [{"type": "web_url", "title": "Complete Booking", "url": link}],
                    )
                else:
                    await client.send_text_message(sender_id, form.success_message)
                    await self._create_lead_from_submission(submission, conversation)
                await self.db.flush()
                return

        current_field = phase1_fields[submission.current_field_index]
        quick_replies = []
        if current_field.field_type == "phone":
            quick_replies = [{"title": "Use my phone", "payload": "USE_PHONE"}]
        elif current_field.field_type == "email":
            quick_replies = [{"title": "Use my email", "payload": "USE_EMAIL"}]

        if quick_replies:
            await client.send_quick_replies(sender_id, current_field.placeholder or f"Please provide your {current_field.label.lower()}:", quick_replies)
        else:
            await client.send_text_message(sender_id, current_field.placeholder or f"Please provide your {current_field.label.lower()}:")
        await self.db.flush()

    async def handle_dm(self, ig_account: IGAccount, sender_id: str, message_text: str, sender_name: str = ""):
        settings_result = await self.db.execute(
            select(IGBotSettings).where(IGBotSettings.ig_account_id == ig_account.id)
        )
        bot_settings = settings_result.scalar_one_or_none()
        if not bot_settings or not bot_settings.dm_auto_reply_enabled:
            return

        conv_result = await self.db.execute(
            select(IGConversation).where(
                IGConversation.ig_account_id == ig_account.id,
                IGConversation.ig_user_id == sender_id,
            )
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            conversation = IGConversation(
                ig_account_id=ig_account.id,
                ig_user_id=sender_id,
                customer_name=sender_name,
            )
            self.db.add(conversation)
            await self.db.flush()

        inbound = IGMessage(
            conversation_id=conversation.id,
            direction="inbound",
            message_type="text",
            content=message_text,
        )
        self.db.add(inbound)

        token = decrypt_token(ig_account.access_token_encrypted)
        client = InstagramGraphClient(token)
        try:
            await client.set_typing_indicator(sender_id)

            active_submission = await self._get_active_submission(conversation.id)
            if active_submission:
                handled = await self._process_form_answer(conversation, message_text, client, sender_id)
                if handled:
                    provider_info = await self.get_active_provider()
                    if provider_info:
                        provider, api_key = provider_info
                        usage_log = AIUsageLog(
                            ai_provider_id=provider.id,
                            ig_account_id=ig_account.id,
                            conversation_id=conversation.id,
                            input_tokens=0,
                            output_tokens=0,
                            model=provider.model_name,
                            cost_estimate=0,
                        )
                        self.db.add(usage_log)
                    conversation.last_message_at = inbound.created_at
                    await self.db.flush()
                    return

            provider_info = await self.get_active_provider()
            if not provider_info:
                await client.send_text_message(sender_id, bot_settings.after_hours_message)
                return

            provider, api_key = provider_info

            active_forms = await self._get_active_forms(ig_account.id)
            enhanced_prompt = build_form_aware_prompt(bot_settings.ai_system_prompt, active_forms)

            history_result = await self.db.execute(
                select(IGMessage)
                .where(IGMessage.conversation_id == conversation.id)
                .order_by(IGMessage.created_at.desc())
                .limit(20)
            )
            history = list(reversed(history_result.scalars().all()))
            messages = [{"role": "assistant" if m.direction == "outbound" else "user", "content": m.content} for m in history]

            response = await ai_service.generate_response(
                messages=messages,
                system_prompt=enhanced_prompt,
                provider_name=provider.provider,
                api_key=api_key,
                model=provider.model_name,
            )

            if response.text:
                clean_text, intent = parse_intent_from_response(response.text)

                if intent and intent.get("trigger_form") and intent.get("confidence", 0) > 0.7:
                    form_name = intent["trigger_form"]
                    form_result = await self.db.execute(
                        select(IGForm).where(IGForm.name == form_name, IGForm.is_active == True)
                    )
                    form = form_result.scalar_one_or_none()
                    if form:
                        if clean_text:
                            await client.send_text_message(sender_id, clean_text)
                            outbound = IGMessage(
                                conversation_id=conversation.id,
                                direction="outbound",
                                message_type="text",
                                content=clean_text,
                                ai_provider=provider.provider,
                                ai_input_tokens=response.input_tokens,
                                ai_output_tokens=response.output_tokens,
                                ai_cost_estimate=ai_service.estimate_cost(provider.provider, response.input_tokens, response.output_tokens),
                            )
                            self.db.add(outbound)

                        await self._start_form(
                            form, conversation, client, sender_id,
                            pre_filled=intent.get("pre_filled", {}),
                        )
                    else:
                        await client.send_text_message(sender_id, clean_text)
                        outbound = IGMessage(
                            conversation_id=conversation.id,
                            direction="outbound",
                            message_type="text",
                            content=clean_text,
                            ai_provider=provider.provider,
                            ai_input_tokens=response.input_tokens,
                            ai_output_tokens=response.output_tokens,
                            ai_cost_estimate=ai_service.estimate_cost(provider.provider, response.input_tokens, response.output_tokens),
                        )
                        self.db.add(outbound)
                else:
                    await client.send_text_message(sender_id, response.text)
                    outbound = IGMessage(
                        conversation_id=conversation.id,
                        direction="outbound",
                        message_type="text",
                        content=response.text,
                        ai_provider=provider.provider,
                        ai_input_tokens=response.input_tokens,
                        ai_output_tokens=response.output_tokens,
                        ai_cost_estimate=ai_service.estimate_cost(provider.provider, response.input_tokens, response.output_tokens),
                    )
                    self.db.add(outbound)

                usage_log = AIUsageLog(
                    ai_provider_id=provider.id,
                    ig_account_id=ig_account.id,
                    conversation_id=conversation.id,
                    input_tokens=response.input_tokens,
                    output_tokens=response.output_tokens,
                    model=response.model,
                    cost_estimate=outbound.ai_cost_estimate if outbound else 0,
                )
                self.db.add(usage_log)

            conversation.last_message_at = inbound.created_at
            await self.db.flush()

            if bot_settings.lead_qualification_enabled:
                await self._qualify_lead(conversation, message_text, response.text if response.text else "")
        finally:
            await client.close()

    async def handle_comment(self, ig_account: IGAccount, media_id: str, comment_id: str, username: str, text: str):
        settings_result = await self.db.execute(
            select(IGBotSettings).where(IGBotSettings.ig_account_id == ig_account.id)
        )
        bot_settings = settings_result.scalar_one_or_none()

        existing = await self.db.execute(
            select(IGComment).where(IGComment.comment_id == comment_id)
        )
        if existing.scalar_one_or_none():
            return

        comment_record = IGComment(
            ig_account_id=ig_account.id,
            media_id=media_id,
            comment_id=comment_id,
            username=username,
            text=text,
        )

        rules_result = await self.db.execute(
            select(IGCommentRule).where(
                IGCommentRule.ig_account_id == ig_account.id,
                IGCommentRule.is_active == True,
            ).order_by(IGCommentRule.priority.desc())
        )
        rules = rules_result.scalars().all()

        token = decrypt_token(ig_account.access_token_encrypted)
        client = InstagramGraphClient(token)

        action_taken = "none"
        ai_reply_text = None

        try:
            for rule in rules:
                matched = False
                if rule.rule_type == "keyword_match" and rule.trigger_words:
                    text_lower = text.lower()
                    matched = any(w.lower() in text_lower for w in rule.trigger_words)
                elif rule.rule_type == "ai_reply":
                    matched = True

                if not matched:
                    continue

                if rule.action == "moderation":
                    if rule.trigger_words and any(w.lower() in text.lower() for w in rule.trigger_words):
                        await client.hide_comment(comment_id)
                        action_taken = "hidden"
                        break
                    continue

                if rule.action == "reply_comment" and rule.reply_template:
                    await client.reply_to_comment(comment_id, rule.reply_template)
                    action_taken = "replied_comment"
                    ai_reply_text = rule.reply_template
                    break

                if rule.action == "reply_dm":
                    provider_info = await self.get_active_provider()
                    if provider_info:
                        provider, api_key = provider_info
                        prompt = rule.ai_prompt or bot_settings.ai_system_prompt if bot_settings else "You are a helpful representative."
                        messages = [{"role": "user", "content": f"Comment by @{username}: {text}"}]
                        response = await ai_service.generate_response(
                            messages=messages,
                            system_prompt=prompt,
                            provider_name=provider.provider,
                            api_key=api_key,
                            model=provider.model_name,
                        )
                        if response.text:
                            await client.send_private_reply(comment_id, response.text)
                            action_taken = "replied_dm"
                            ai_reply_text = response.text

                            usage_log = AIUsageLog(
                                ai_provider_id=provider.id,
                                ig_account_id=ig_account.id,
                                input_tokens=response.input_tokens,
                                output_tokens=response.output_tokens,
                                model=response.model,
                                cost_estimate=ai_service.estimate_cost(provider.provider, response.input_tokens, response.output_tokens),
                            )
                            self.db.add(usage_log)
                    break

                if rule.action == "reply_comment":
                    reply_text = rule.reply_template or "Thanks for your comment!"
                    await client.reply_to_comment(comment_id, reply_text)
                    action_taken = "replied_comment"
                    ai_reply_text = reply_text
                    break
        finally:
            await client.close()

        comment_record.action_taken = action_taken
        comment_record.ai_reply = ai_reply_text
        self.db.add(comment_record)
        await self.db.flush()

    async def _qualify_lead(self, conversation: IGConversation, user_message: str, ai_response: str):
        combined = f"{user_message} {ai_response}".lower()
        is_lead = any(re.search(p, combined, re.IGNORECASE) for p in LEAD_SIGNALS)
        if not is_lead:
            return

        existing_lead = await self.db.execute(
            select(Lead).where(Lead.id == conversation.lead_id)
        )
        if existing_lead.scalar_one_or_none():
            return

        lead = Lead(
            store_id=None,
            source="instagram",
            name=conversation.customer_name or conversation.ig_user_id,
            phone="",
            status="warm",
            stage="new",
        )
        self.db.add(lead)
        await self.db.flush()
        conversation.lead_id = lead.id
        await self.db.flush()


async def poll_and_process_comments(db: AsyncSession):
    result = await db.execute(select(IGAccount).where(IGAccount.is_active == True))
    accounts = result.scalars().all()

    for account in accounts:
        token = decrypt_token(account.access_token_encrypted)
        client = InstagramGraphClient(token)
        engine = BotEngine(db)
        try:
            media_result = await client.get_media_list(limit=10)
            if "data" not in media_result:
                continue

            for media in media_result["data"]:
                media_id = media["id"]
                comments_result = await client.get_media_comments(media_id, limit=25)
                if "data" not in comments_result:
                    continue

                for comment in comments_result["data"]:
                    await engine.handle_comment(
                        ig_account=account,
                        media_id=media_id,
                        comment_id=comment["id"],
                        username=comment.get("username", ""),
                        text=comment.get("text", ""),
                    )
        except Exception as e:
            logger.error("Comment polling error for account %s: %s", account.ig_user_id, e)
        finally:
            await client.close()
