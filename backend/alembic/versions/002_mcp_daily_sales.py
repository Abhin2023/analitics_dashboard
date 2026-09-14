"""add mcp_daily_sales table and store mcp/country columns

Revision ID: 002
Revises: 001
Create Date: 2026-09-14
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("stores", sa.Column("country", sa.String(50), server_default="India"))
    op.add_column("stores", sa.Column("mcp_country_id", sa.Integer(), nullable=True))
    op.add_column("stores", sa.Column("mcp_shop_name", sa.String(150), nullable=True))
    op.add_column("stores", sa.Column("needs_review", sa.Boolean(), server_default=sa.text("0")))

    op.create_table(
        "mcp_daily_sales",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.Integer(), sa.ForeignKey("stores.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("revenue", sa.Numeric(14, 2), server_default="0"),
        sa.Column("units_sold", sa.Integer(), server_default="0"),
        sa.Column("new_sale_count", sa.Integer(), server_default="0"),
        sa.Column("replacement_count", sa.Integer(), server_default="0"),
        sa.Column("return_count", sa.Integer(), server_default="0"),
        sa.Column("target", sa.Numeric(14, 2), server_default="0"),
        sa.Column("currency", sa.String(10), server_default=""),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("store_id", "date", name="uq_mcp_daily_sales_store_date"),
    )
    op.create_index(
        "ix_mcp_daily_sales_store_date", "mcp_daily_sales", ["store_id", "date"]
    )


def downgrade() -> None:
    op.drop_index("ix_mcp_daily_sales_store_date", table_name="mcp_daily_sales")
    op.drop_table("mcp_daily_sales")
    op.drop_column("stores", "needs_review")
    op.drop_column("stores", "mcp_shop_name")
    op.drop_column("stores", "mcp_country_id")
    op.drop_column("stores", "country")
