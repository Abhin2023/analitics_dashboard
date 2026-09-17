"""add insight_resolution_log table

Tracks, per auto-detected rule_key, when it was first raised, when it was
last seen still triggering, and when (if ever) it stopped triggering —
i.e. got resolved. This is what actually lets the insight engine's
usefulness be measured over time (how many detected issues get fixed, how
long that takes) instead of just trusting that the rules are good.

Revision ID: 008
Revises: 007
Create Date: 2026-09-19
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "insight_resolution_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("rule_key", sa.String(150), nullable=False, unique=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("first_detected_at", sa.DateTime(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_insight_log_month", "insight_resolution_log", ["month"])


def downgrade() -> None:
    op.drop_index("ix_insight_log_month", table_name="insight_resolution_log")
    op.drop_table("insight_resolution_log")
