"""Domínio clínico: pacientes, psicólogos, consultas, cobranças, sessão ao vivo, agenda.

Alinhado a docs/schema-fisico-postgresql.sql e app.models.clinical.
Idempotente: ENUMs via DO duplicate_object; tabelas/índices só são criados se ainda
não existirem (ex.: banco já provisionado com docs/schema-fisico-postgresql.sql).

Revision ID: 005_clinical_domain
Revises: 004_user_phone_terms
Create Date: 2026-04-18

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "005_clinical_domain"
down_revision: str | None = "004_user_phone_terms"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _existing_tables(bind) -> set[str]:
    insp = inspect(bind)
    return set(insp.get_table_names(schema="public"))


def upgrade() -> None:
    # Enums (idempotente se o banco já tiver sido provisionado pelo SQL manual)
    op.execute(
        """
        DO $$
        BEGIN
          CREATE TYPE consulta_status AS ENUM (
            'agendada', 'confirmada', 'em_andamento', 'realizada', 'cancelada', 'nao_compareceu'
          );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          CREATE TYPE consulta_modalidade AS ENUM ('Online', 'Presencial');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          CREATE TYPE consulta_situacao_pagamento AS ENUM ('Pago', 'Pendente');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          CREATE TYPE cobranca_status_gateway AS ENUM (
            'awaiting_payment', 'succeeded', 'failed'
          );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END$$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          CREATE TYPE sessao_ao_vivo_fase AS ENUM (
            'patient_waiting', 'live', 'ended'
          );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END$$;
        """
    )

    consulta_status = postgresql.ENUM(
        "agendada",
        "confirmada",
        "em_andamento",
        "realizada",
        "cancelada",
        "nao_compareceu",
        name="consulta_status",
        create_type=False,
    )
    consulta_modalidade = postgresql.ENUM("Online", "Presencial", name="consulta_modalidade", create_type=False)
    consulta_situacao_pagamento = postgresql.ENUM(
        "Pago", "Pendente", name="consulta_situacao_pagamento", create_type=False
    )
    cobranca_status_gateway = postgresql.ENUM(
        "awaiting_payment",
        "succeeded",
        "failed",
        name="cobranca_status_gateway",
        create_type=False,
    )
    sessao_ao_vivo_fase = postgresql.ENUM(
        "patient_waiting",
        "live",
        "ended",
        name="sessao_ao_vivo_fase",
        create_type=False,
    )

    bind = op.get_bind()
    tables = _existing_tables(bind)

    if "pacientes" not in tables:
        op.create_table(
        "pacientes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contato_emergencia", sa.Text(), nullable=True),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["usuario_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("usuario_id", name="pacientes_usuario_id_key"),
    )
        op.create_index("ix_pacientes_usuario_id", "pacientes", ["usuario_id"], unique=False)

    if "psicologos" not in tables:
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

    if "consultas" not in tables:
        op.create_table(
        "consultas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("paciente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("psicologo_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("data_agendada", sa.Date(), nullable=False),
        sa.Column("hora_inicio", sa.Time(), nullable=False),
        sa.Column("duracao_minutos", sa.SmallInteger(), nullable=False, server_default=sa.text("50")),
        sa.Column("modalidade", consulta_modalidade, nullable=False),
        sa.Column(
            "status",
            consulta_status,
            nullable=False,
            server_default=sa.text("'agendada'::consulta_status"),
        ),
        sa.Column(
            "situacao_pagamento",
            consulta_situacao_pagamento,
            nullable=False,
            server_default=sa.text("'Pendente'::consulta_situacao_pagamento"),
        ),
        sa.Column("valor_acordado", sa.Numeric(12, 2), nullable=False),
        sa.Column("especialidade_atendida", sa.String(length=120), nullable=False, server_default=sa.text("''")),
        sa.Column("link_videochamada_opcional", sa.Text(), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "atualizado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["paciente_id"], ["pacientes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["psicologo_id"], ["psicologos.id"], ondelete="RESTRICT"),
    )
        op.create_index("ix_consultas_paciente_data", "consultas", ["paciente_id", "data_agendada"], unique=False)
        op.create_index("ix_consultas_psicologo_data", "consultas", ["psicologo_id", "data_agendada"], unique=False)
        op.create_index("ix_consultas_status", "consultas", ["status"], unique=False)
        op.create_index(
            "uq_consultas_psicologo_inicio",
            "consultas",
            ["psicologo_id", "data_agendada", "hora_inicio"],
            unique=True,
            postgresql_where=sa.text("status NOT IN ('cancelada', 'nao_compareceu')"),
        )

    if "cobrancas" not in tables:
        op.create_table(
        "cobrancas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("consulta_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("valor_centavos", sa.BigInteger(), nullable=False),
        sa.Column("moeda", sa.CHAR(length=3), nullable=False, server_default=sa.text("'BRL'")),
        sa.Column(
            "provedor_gateway",
            sa.String(length=64),
            nullable=False,
            server_default=sa.text("'stripe_compatible_mock'"),
        ),
        sa.Column("id_intent_gateway", sa.String(length=128), nullable=False),
        sa.Column(
            "status_gateway",
            cobranca_status_gateway,
            nullable=False,
            server_default=sa.text("'awaiting_payment'::cobranca_status_gateway"),
        ),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("pago_em", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("valor_centavos >= 0", name="cobrancas_valor_centavos_check"),
        sa.ForeignKeyConstraint(["consulta_id"], ["consultas.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("consulta_id", name="cobrancas_consulta_id_key"),
    )
        op.create_index("ix_cobrancas_status", "cobrancas", ["status_gateway"], unique=False)
        op.create_index("uq_cobrancas_intent", "cobrancas", ["id_intent_gateway"], unique=True)

    if "sessoes_ao_vivo" not in tables:
        op.create_table(
        "sessoes_ao_vivo",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("consulta_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "fase",
            sessao_ao_vivo_fase,
            nullable=False,
            server_default=sa.text("'patient_waiting'::sessao_ao_vivo_fase"),
        ),
        sa.Column("url_meet", sa.Text(), nullable=True),
        sa.Column("paciente_entrou_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("desbloqueio_play_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cronometro_iniciado_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("encerrada_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "atualizado_em",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["consulta_id"], ["consultas.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("consulta_id", name="sessoes_ao_vivo_consulta_id_key"),
    )
        op.create_index("ix_sessoes_fase", "sessoes_ao_vivo", ["fase"], unique=False)

    if "disponibilidade_semanal" not in tables:
        op.create_table(
        "disponibilidade_semanal",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("psicologo_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dia_semana", sa.SmallInteger(), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("hora_inicio", sa.Time(), nullable=False),
        sa.Column("hora_fim", sa.Time(), nullable=False),
        sa.CheckConstraint("dia_semana >= 0 AND dia_semana <= 6", name="disponibilidade_semanal_dia_check"),
        sa.CheckConstraint("hora_fim > hora_inicio", name="ck_disponibilidade_janela"),
        sa.ForeignKeyConstraint(["psicologo_id"], ["psicologos.id"], ondelete="CASCADE"),
    )
        op.create_index(
            "uq_disponibilidade_psicologo_dia",
            "disponibilidade_semanal",
            ["psicologo_id", "dia_semana"],
            unique=True,
        )

    if "bloqueios_agenda" not in tables:
        op.create_table(
        "bloqueios_agenda",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("psicologo_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("data_bloqueio", sa.Date(), nullable=False),
        sa.Column("dia_inteiro", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("hora_inicio", sa.Time(), nullable=True),
        sa.Column("hora_fim", sa.Time(), nullable=True),
        sa.Column("motivo", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.CheckConstraint(
            "dia_inteiro OR (hora_inicio IS NOT NULL AND hora_fim IS NOT NULL AND hora_fim > hora_inicio)",
            name="ck_bloqueios_janela",
        ),
        sa.ForeignKeyConstraint(["psicologo_id"], ["psicologos.id"], ondelete="CASCADE"),
    )
        op.create_index("ix_bloqueios_psicologo_data", "bloqueios_agenda", ["psicologo_id", "data_bloqueio"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_bloqueios_psicologo_data", table_name="bloqueios_agenda", if_exists=True)
    op.drop_table("bloqueios_agenda", if_exists=True)

    op.drop_index("uq_disponibilidade_psicologo_dia", table_name="disponibilidade_semanal", if_exists=True)
    op.drop_table("disponibilidade_semanal", if_exists=True)

    op.drop_index("ix_sessoes_fase", table_name="sessoes_ao_vivo", if_exists=True)
    op.drop_table("sessoes_ao_vivo", if_exists=True)

    op.drop_index("uq_cobrancas_intent", table_name="cobrancas", if_exists=True)
    op.drop_index("ix_cobrancas_status", table_name="cobrancas", if_exists=True)
    op.drop_table("cobrancas", if_exists=True)

    op.drop_index("uq_consultas_psicologo_inicio", table_name="consultas", if_exists=True)
    op.drop_index("ix_consultas_status", table_name="consultas", if_exists=True)
    op.drop_index("ix_consultas_psicologo_data", table_name="consultas", if_exists=True)
    op.drop_index("ix_consultas_paciente_data", table_name="consultas", if_exists=True)
    op.drop_table("consultas", if_exists=True)

    op.drop_index("uq_psicologos_crp", table_name="psicologos", if_exists=True)
    op.drop_index("ix_psicologos_usuario_id", table_name="psicologos", if_exists=True)
    op.drop_table("psicologos", if_exists=True)

    op.drop_index("ix_pacientes_usuario_id", table_name="pacientes", if_exists=True)
    op.drop_table("pacientes", if_exists=True)

    op.execute("DROP TYPE IF EXISTS sessao_ao_vivo_fase CASCADE")
    op.execute("DROP TYPE IF EXISTS cobranca_status_gateway CASCADE")
    op.execute("DROP TYPE IF EXISTS consulta_situacao_pagamento CASCADE")
    op.execute("DROP TYPE IF EXISTS consulta_modalidade CASCADE")
    op.execute("DROP TYPE IF EXISTS consulta_status CASCADE")
