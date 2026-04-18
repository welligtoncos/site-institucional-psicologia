"""Paciente: telefone e data de aceite dos termos (RF-001).

Revision ID: 004_user_phone_terms
Revises: 003_user_roles_three_profiles
Create Date: 2026-04-17

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "004_user_phone_terms"
down_revision: str | None = "003_user_roles_three_profiles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "phone",
            sa.String(length=30),
            nullable=False,
            server_default="",
        ),
    )
    op.add_column(
        "users",
        sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "terms_accepted_at")
    op.drop_column("users", "phone")
