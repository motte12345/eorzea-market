"""add exclusion tables and seed existing excluded ids

Revision ID: 7c2a91e4d8b3
Revises: 3e7bacf9e868
Create Date: 2026-04-28 00:00:00.000000

"""
from datetime import datetime, timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "7c2a91e4d8b3"
down_revision: Union[str, None] = "228fb74b118e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 既存のハードコード除外リスト（update_ranking.py から移行）
SEED_EXCLUDED_IDS: list[int] = [
    5859, 39494, 33687, 39493, 33688,
    5852, 5867, 2821,
    3167, 5410, 5833, 5592, 3865, 9741, 8825, 5591, 8824, 5853,
    43685, 5103, 5225, 5311, 5399, 5849, 5880, 5870,
    18013, 5450, 5846, 5844, 4817, 8828, 7991, 2043, 2823, 3168,
    4256, 23853, 5854, 11918, 13642,
]


def upgrade() -> None:
    op.create_table(
        "excluded_items",
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("excluded_at", sa.DateTime(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"]),
        sa.PrimaryKeyConstraint("item_id"),
    )

    op.create_table(
        "exclusion_requests",
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("first_requested_at", sa.DateTime(), nullable=False),
        sa.Column("last_requested_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"]),
        sa.PrimaryKeyConstraint("item_id"),
    )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if SEED_EXCLUDED_IDS:
        rows = [{"item_id": iid, "excluded_at": now, "reason": "legacy hardcoded"} for iid in SEED_EXCLUDED_IDS]
        op.bulk_insert(
            sa.table(
                "excluded_items",
                sa.column("item_id", sa.Integer),
                sa.column("excluded_at", sa.DateTime),
                sa.column("reason", sa.Text),
            ),
            rows,
        )


def downgrade() -> None:
    op.drop_table("exclusion_requests")
    op.drop_table("excluded_items")
