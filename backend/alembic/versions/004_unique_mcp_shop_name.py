"""add unique constraint on stores.mcp_shop_name

Prevents the same MCP shop from ever being inserted as two separate Store
rows, even when multiple app worker processes race to auto-create the same
new branch at the same moment (each process only holds an in-memory lock
that other processes can't see). MySQL/InnoDB allows multiple NULL values in
a unique-indexed column, so existing stores with no mcp_shop_name are
unaffected — only non-null values must be unique.

IMPORTANT: this migration will fail if any duplicate mcp_shop_name values
still exist in the table. Run scripts/dedupe_mcp_stores.py (and resolve any
near-duplicate spelling variants via the Branch Assignment page) BEFORE
upgrading, or the ADD UNIQUE INDEX statement below will be rejected by MySQL.

Revision ID: 004
Revises: 003
Create Date: 2026-09-16
"""
from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("uq_stores_mcp_shop_name", "stores", ["mcp_shop_name"])


def downgrade() -> None:
    op.drop_constraint("uq_stores_mcp_shop_name", "stores", type_="unique")
