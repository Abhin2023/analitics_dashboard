"""add country_sales_snapshots table

Stores the result of MCP's own country-comparison call (already converted
to USD using its current exchange rates) once per sync, so the
International Sales chart can read a stored value instead of calling MCP
live on every dashboard load.

Revision ID: 006
Revises: 005
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "country_sales_snapshots",
        sa.Column("country", sa.String(50), primary_key=True),
        sa.Column("local_amount", sa.Numeric(16, 2), nullable=True),
        sa.Column("local_currency", sa.String(10), nullable=True),
        sa.Column("usd_amount", sa.Numeric(16, 2), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("country_sales_snapshots")
