from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ── IG Account ───────────────────────────────────────────────────
class IGAccountCreate(BaseModel):
    ig_user_id: str
    page_id: str
    page_name: str = ""
    access_token: str
    store_id: Optional[int] = None


class IGAccountUpdate(BaseModel):
    page_name: Optional[str] = None
    access_token: Optional[str] = None
    store_id: Optional[int] = None
    is_active: Optional[bool] = None


class IGAccountResponse(BaseModel):
    id: int
    ig_user_id: str
    page_id: str
    page_name: str
    store_id: Optional[int]
    store_name: str = ""
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Conversation ─────────────────────────────────────────────────
class IGConversationResponse(BaseModel):
    id: int
    ig_account_id: int
    ig_user_id: str
    customer_name: str
    status: str
    assigned_to: Optional[int]
    assignee_name: str = ""
    lead_id: Optional[int]
    last_message_at: Optional[datetime]
    message_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IGMessageResponse(BaseModel):
    id: int
    conversation_id: int
    direction: str
    message_type: str
    content: str
    ig_message_id: Optional[str]
    ai_provider: Optional[str]
    ai_input_tokens: Optional[int]
    ai_output_tokens: Optional[int]
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IGConversationAssign(BaseModel):
    assigned_to: int


# ── Comment Rules ────────────────────────────────────────────────
class IGCommentRuleCreate(BaseModel):
    name: str
    rule_type: str
    trigger_words: List[str] = []
    action: str
    reply_template: Optional[str] = None
    ai_prompt: Optional[str] = None
    is_active: bool = True
    priority: int = 0


class IGCommentRuleUpdate(BaseModel):
    name: Optional[str] = None
    rule_type: Optional[str] = None
    trigger_words: Optional[List[str]] = None
    action: Optional[str] = None
    reply_template: Optional[str] = None
    ai_prompt: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None


class IGCommentRuleResponse(BaseModel):
    id: int
    ig_account_id: int
    name: str
    rule_type: str
    trigger_words: list
    action: str
    reply_template: Optional[str]
    ai_prompt: Optional[str]
    is_active: bool
    priority: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Bot Settings ─────────────────────────────────────────────────
class IGBotSettingsUpdate(BaseModel):
    dm_auto_reply_enabled: Optional[bool] = None
    comment_auto_reply_enabled: Optional[bool] = None
    comment_moderation_enabled: Optional[bool] = None
    lead_qualification_enabled: Optional[bool] = None
    ai_system_prompt: Optional[str] = None
    welcome_message: Optional[str] = None
    after_hours_message: Optional[str] = None


class IGBotSettingsResponse(BaseModel):
    id: int
    ig_account_id: int
    dm_auto_reply_enabled: bool
    comment_auto_reply_enabled: bool
    comment_moderation_enabled: bool
    lead_qualification_enabled: bool
    ai_system_prompt: str
    welcome_message: str
    after_hours_message: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── AI Provider ──────────────────────────────────────────────────
class AIProviderUpdate(BaseModel):
    api_key: Optional[str] = None
    model_name: Optional[str] = None


class AIProviderToggle(BaseModel):
    is_active: bool


class AIProviderResponse(BaseModel):
    id: int
    provider: str
    model_name: str
    is_active: bool
    api_key_encrypted: str = ""
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Stats ────────────────────────────────────────────────────────
class IGStatsResponse(BaseModel):
    total_conversations: int = 0
    active_conversations: int = 0
    total_messages: int = 0
    messages_sent: int = 0
    messages_received: int = 0
    ai_responses: int = 0
    leads_generated: int = 0
    avg_response_time_minutes: float = 0
    credits_used: dict = {}
    daily_stats: List[dict] = []


# ── Comment ──────────────────────────────────────────────────────
class IGCommentResponse(BaseModel):
    id: int
    ig_account_id: int
    media_id: str
    comment_id: str
    username: str
    text: str
    action_taken: str
    ai_reply: Optional[str]
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
