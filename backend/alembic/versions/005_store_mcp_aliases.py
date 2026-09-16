"""add store_mcp_aliases table (permanent name-to-branch memory)

Records every MCP shop name ever confirmed to belong to a Store, so that
merging a duplicate away doesn't erase the fact that name was already
resolved. Backfills one alias row per store that currently has a
mcp_shop_name set, so existing known mappings aren't lost.

Revision ID: 005
Revises: 004
Create Date: 2026-09-17
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "store_mcp_aliases",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.Integer(), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mcp_shop_name", sa.String(150), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.execute(
        """
        INSERT INTO store_mcp_aliases (store_id, mcp_shop_name, created_at)
        SELECT id, mcp_shop_name, NOW() FROM stores WHERE mcp_shop_name IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_table("store_mcp_aliases")
