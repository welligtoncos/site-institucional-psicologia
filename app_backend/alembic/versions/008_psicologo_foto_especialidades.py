"""Foto e especialidades do perfil público do psicólogo.

Revision ID: 008_psic_foto_esp
Revises: 007_paciente_dados_cadastrais
Create Date: 2026-04-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "008_psic_foto_esp"
down_revision: str | None = "007_paciente_dados_cadastrais"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if "psicologos" not in inspect(bind).get_table_names(schema="public"):
        return

    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("psicologos", schema="public")}

    if "foto_url" not in cols:
        op.add_column("psicologos", sa.Column("foto_url", sa.Text(), nullable=True))
    if "especialidades" not in cols:
        op.add_column(
            "psicologos",
            sa.Column("especialidades", sa.Text(), nullable=True, server_default=""),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if "psicologos" not in inspect(bind).get_table_names(schema="public"):
        return

    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("psicologos", schema="public")}

    if "especialidades" in cols:
        op.drop_column("psicologos", "especialidades")
    if "foto_url" in cols:
        op.drop_column("psicologos", "foto_url")
