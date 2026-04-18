"""Garante tabela `psicologos` quando o banco ficou parcial (ex.: SQL manual só com pacientes).

Cenário: `005_clinical_domain` já consta em `alembic_version`, mas `psicologos` não existe —
GET /profiles/psychologist/me falha com UndefinedTableError. Esta revisão só cria o que faltar.

Revision ID: 006_ensure_psicologos
Revises: 005_clinical_domain
Create Date: 2026-04-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "006_ensure_psicologos"
down_revision: str | None = "005_clinical_domain"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _existing_tables(bind) -> set[str]:
    insp = inspect(bind)
    return set(insp.get_table_names(schema="public"))


def upgrade() -> None:
    bind = op.get_bind()
    tables = _existing_tables(bind)
    if "psicologos" in tables:
        return

    op.create_table(
        "psicologos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("crp", sa.String(length=32), nullable=False),
        sa.Column("bio", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column("valor_sessao_padrao", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("duracao_minutos_padrao", sa.SmallInteger(), nullable=False, server_default=sa.text("50")),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["usuario_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("usuario_id", name="psicologos_usuario_id_key"),
    )
    op.create_index("ix_psicologos_usuario_id", "psicologos", ["usuario_id"], unique=False)
    op.create_index("uq_psicologos_crp", "psicologos", ["crp"], unique=True)


def downgrade() -> None:
    # Não remove dados em produção; downgrade manual se necessário.
    pass
