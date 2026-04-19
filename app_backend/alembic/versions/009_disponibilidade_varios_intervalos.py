"""Permite vários intervalos de disponibilidade no mesmo dia da semana.

Remove o índice único (psicologo_id, dia_semana) de `disponibilidade_semanal`.

Revision ID: 009_disp_multi
Revises: 008_psic_foto_esp
Create Date: 2026-04-19
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import inspect

revision: str = "009_disp_multi"
down_revision: str | None = "008_psic_foto_esp"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if "disponibilidade_semanal" not in inspect(bind).get_table_names(schema="public"):
        return
    op.drop_index("uq_disponibilidade_psicologo_dia", table_name="disponibilidade_semanal", if_exists=True)
    op.create_index(
        "ix_disponibilidade_psicologo_dia",
        "disponibilidade_semanal",
        ["psicologo_id", "dia_semana"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    if "disponibilidade_semanal" not in inspect(bind).get_table_names(schema="public"):
        return
    op.drop_index("ix_disponibilidade_psicologo_dia", table_name="disponibilidade_semanal", if_exists=True)
    op.create_index(
        "uq_disponibilidade_psicologo_dia",
        "disponibilidade_semanal",
        ["psicologo_id", "dia_semana"],
        unique=True,
    )
