"""add dashboard_chat_log table

Tracks every dashboard chatbot exchange's token usage/cost, separately from
AISummaryRun (the executive summary feature) and ai_usage_log (the
Instagram bot) — each AI feature logs its own usage so cost can be
attributed to the specific feature causing it, per user, over time.

Revision ID: 009
Revises: 008
Create Date: 2026-09-19
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dashboard_chat_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("input_tokens", sa.Integer(), default=0),
        sa.Column("output_tokens", sa.Integer(), default=0),
        sa.Column("cost_estimate", sa.Numeric(10, 6), default=0),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_chat_log_created_at", "dashboard_chat_log", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_chat_log_created_at", table_name="dashboard_chat_log")
    op.drop_table("dashboard_chat_log")
