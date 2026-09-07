"""add ig_faqs table

Revision ID: 001
Revises: None
Create Date: 2026-08-18
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ig_faqs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "ig_account_id",
            sa.Integer(),
            sa.ForeignKey("ig_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("question", sa.String(500), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("keywords", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1")),
        sa.Column("priority", sa.Integer(), server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_ig_faq_account_active",
        "ig_faqs",
        ["ig_account_id", "is_active"],
    )


def downgrade() -> None:
    op.drop_index("ix_ig_faq_account_active", table_name="ig_faqs")
    op.drop_table("ig_faqs")
