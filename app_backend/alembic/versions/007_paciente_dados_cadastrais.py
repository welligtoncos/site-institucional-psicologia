"""Campos de cadastro do paciente: CPF, nascimento e endereço.

Revision ID: 007_paciente_dados_cadastrais
Revises: 006_ensure_psicologos
Create Date: 2026-04-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "007_paciente_dados_cadastrais"
down_revision: str | None = "006_ensure_psicologos"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _existing_columns(bind, table: str) -> set[str]:
    insp = inspect(bind)
    cols = insp.get_columns(table, schema="public")
    return {c["name"] for c in cols}


def upgrade() -> None:
    bind = op.get_bind()
    if "pacientes" not in inspect(bind).get_table_names(schema="public"):
        return

    existing = _existing_columns(bind, "pacientes")
    if "cpf" not in existing:
        op.add_column("pacientes", sa.Column("cpf", sa.String(length=11), nullable=True))
    if "data_nascimento" not in existing:
        op.add_column("pacientes", sa.Column("data_nascimento", sa.Date(), nullable=True))
    if "cep" not in existing:
        op.add_column("pacientes", sa.Column("cep", sa.String(length=12), nullable=True))
    if "logradouro" not in existing:
        op.add_column("pacientes", sa.Column("logradouro", sa.String(length=255), nullable=True))
    if "numero" not in existing:
        op.add_column("pacientes", sa.Column("numero", sa.String(length=32), nullable=True))
    if "complemento" not in existing:
        op.add_column("pacientes", sa.Column("complemento", sa.String(length=120), nullable=True))
    if "bairro" not in existing:
        op.add_column("pacientes", sa.Column("bairro", sa.String(length=120), nullable=True))
    if "cidade" not in existing:
        op.add_column("pacientes", sa.Column("cidade", sa.String(length=120), nullable=True))
    if "uf" not in existing:
        op.add_column("pacientes", sa.Column("uf", sa.String(length=2), nullable=True))
    if "ponto_referencia" not in existing:
        op.add_column("pacientes", sa.Column("ponto_referencia", sa.Text(), nullable=True))

    insp = inspect(bind)
    indexes = {ix["name"] for ix in insp.get_indexes("pacientes", schema="public")}
    if "uq_pacientes_cpf" not in indexes:
        op.create_index(
            "uq_pacientes_cpf",
            "pacientes",
            ["cpf"],
            unique=True,
            postgresql_where=sa.text("cpf IS NOT NULL"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if "pacientes" not in inspect(bind).get_table_names(schema="public"):
        return

    insp = inspect(bind)
    indexes = {ix["name"] for ix in insp.get_indexes("pacientes", schema="public")}
    if "uq_pacientes_cpf" in indexes:
        op.drop_index("uq_pacientes_cpf", table_name="pacientes")

    existing = _existing_columns(bind, "pacientes")
    for col in (
        "ponto_referencia",
        "uf",
        "cidade",
        "bairro",
        "complemento",
        "numero",
        "logradouro",
        "cep",
        "data_nascimento",
        "cpf",
    ):
        if col in existing:
            op.drop_column("pacientes", col)
