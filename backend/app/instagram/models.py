from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime,
    ForeignKey, JSON, UniqueConstraint, Index, Numeric,
)
from sqlalchemy.orm import relationship
from ..db.base import Base


class IGAccount(Base):
    __tablename__ = "ig_accounts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    ig_user_id = Column(String(100), unique=True, nullable=False, index=True)
    page_id = Column(String(100), nullable=False)
    page_name = Column(String(200), default="")
    access_token_encrypted = Column(Text, nullable=False)
    token_expires_at = Column(DateTime, nullable=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store", backref="ig_accounts")
    conversations = relationship("IGConversation", back_populates="ig_account", cascade="all, delete-orphan")
    comment_rules = relationship("IGCommentRule", back_populates="ig_account", cascade="all, delete-orphan")
    bot_settings = relationship("IGBotSettings", back_populates="ig_account", uselist=False, cascade="all, delete-orphan")
    comments = relationship("IGComment", back_populates="ig_account", cascade="all, delete-orphan")


class IGConversation(Base):
    __tablename__ = "ig_conversations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    ig_account_id = Column(Integer, ForeignKey("ig_accounts.id", ondelete="CASCADE"), nullable=False)
    ig_user_id = Column(String(100), nullable=False)
    customer_name = Column(String(200), default="")
    status = Column(String(20), default="active")
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    last_message_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    ig_account = relationship("IGAccount", back_populates="conversations")
    assignee = relationship("User", foreign_keys=[assigned_to])
    lead = relationship("Lead", backref="ig_conversations")
    messages = relationship("IGMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="IGMessage.created_at")

    __table_args__ = (
        UniqueConstraint("ig_account_id", "ig_user_id"),
        Index("ix_ig_conv_account_user", "ig_account_id", "ig_user_id"),
    )


class IGMessage(Base):
    __tablename__ = "ig_messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("ig_conversations.id", ondelete="CASCADE"), nullable=False)
    direction = Column(String(10), nullable=False)
    message_type = Column(String(20), default="text")
    content = Column(Text, default="")
    ig_message_id = Column(String(100), nullable=True)
    ai_provider = Column(String(20), nullable=True)
    ai_input_tokens = Column(Integer, nullable=True)
    ai_output_tokens = Column(Integer, nullable=True)
    ai_cost_estimate = Column(Numeric(10, 6), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("IGConversation", back_populates="messages")


class IGComment(Base):
    __tablename__ = "ig_comments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    ig_account_id = Column(Integer, ForeignKey("ig_accounts.id", ondelete="CASCADE"), nullable=False)
    media_id = Column(String(100), nullable=False)
    comment_id = Column(String(100), nullable=False)
    username = Column(String(200), default="")
    text = Column(Text, default="")
    action_taken = Column(String(20), default="none")
    ai_reply = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    ig_account = relationship("IGAccount", back_populates="comments")

    __table_args__ = (
        UniqueConstraint("ig_account_id", "comment_id"),
    )


class IGCommentRule(Base):
    __tablename__ = "ig_comment_rules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    ig_account_id = Column(Integer, ForeignKey("ig_accounts.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    rule_type = Column(String(20), nullable=False)
    trigger_words = Column(JSON, default=list)
    action = Column(String(20), nullable=False)
    reply_template = Column(Text, nullable=True)
    ai_prompt = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    ig_account = relationship("IGAccount", back_populates="comment_rules")


class AIProvider(Base):
    __tablename__ = "ai_providers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    provider = Column(String(20), nullable=False, unique=True)
    api_key_encrypted = Column(Text, nullable=False)
    model_name = Column(String(100), default="")
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    usage_logs = relationship("AIUsageLog", back_populates="ai_provider")


class AIUsageLog(Base):
    __tablename__ = "ai_usage_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    ai_provider_id = Column(Integer, ForeignKey("ai_providers.id"), nullable=False)
    ig_account_id = Column(Integer, ForeignKey("ig_accounts.id"), nullable=True)
    conversation_id = Column(Integer, ForeignKey("ig_conversations.id"), nullable=True)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    model = Column(String(100), default="")
    cost_estimate = Column(Numeric(10, 6), default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    ai_provider = relationship("AIProvider", back_populates="usage_logs")
    ig_account = relationship("IGAccount")
    conversation = relationship("IGConversation")


class IGBotSettings(Base):
    __tablename__ = "ig_bot_settings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    ig_account_id = Column(Integer, ForeignKey("ig_accounts.id", ondelete="CASCADE"), nullable=False, unique=True)
    dm_auto_reply_enabled = Column(Boolean, default=False)
    comment_auto_reply_enabled = Column(Boolean, default=False)
    comment_moderation_enabled = Column(Boolean, default=False)
    lead_qualification_enabled = Column(Boolean, default=False)
    ai_system_prompt = Column(Text, default="You are a helpful customer service representative for BreakProtection. Be friendly, professional, and concise.")
    welcome_message = Column(Text, default="Hello! Welcome to BreakProtection. How can we help you today?")
    after_hours_message = Column(Text, default="Thank you for reaching out! Our team will get back to you shortly during business hours.")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    ig_account = relationship("IGAccount", back_populates="bot_settings")
