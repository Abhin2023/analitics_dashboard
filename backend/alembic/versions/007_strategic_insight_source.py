"""add source/rule_key to strategic_insights

Distinguishes insights the insight engine detects automatically from data
(source="auto") from the existing human-authored/Sheet-synced ones
(source="manual", the default — preserves current rows unchanged).
rule_key is a stable per-(rule, entity) identifier so each engine run can
cleanly replace its own previous output (delete-then-reinsert by
month+source="auto") without touching manual insights, and so a later
feedback-loop feature can track a specific detected condition across runs.

Revision ID: 007
Revises: 006
Create Date: 2026-09-19
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "strategic_insights",
        sa.Column("source", sa.String(10), nullable=False, server_default="manual"),
    )
    op.add_column(
        "strategic_insights",
        sa.Column("rule_key", sa.String(150), nullable=True),
    )
    op.create_index("ix_insight_month_source", "strategic_insights", ["month", "source"])


def downgrade() -> None:
    op.drop_index("ix_insight_month_source", table_name="strategic_insights")
    op.drop_column("strategic_insights", "rule_key")
    op.drop_column("strategic_insights", "source")
