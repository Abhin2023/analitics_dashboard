"""add users.store_id and users.team_leader_id

Revision ID: 003
Revises: 002
Create Date: 2026-09-15
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("store_id", sa.Integer(), sa.ForeignKey("stores.id"), nullable=True))
    op.add_column("users", sa.Column("team_leader_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "team_leader_id")
    op.drop_column("users", "store_id")
