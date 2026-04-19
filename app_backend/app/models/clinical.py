"""
Entidades ORM do domínio clínico (pacientes, psicólogos, consultas e agenda).

Mapeia as tabelas definidas em docs/schema-fisico-postgresql.sql.
"""

import enum
import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    BIGINT,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ConsultaStatus(str, enum.Enum):
    agendada = "agendada"
    confirmada = "confirmada"
    em_andamento = "em_andamento"
    realizada = "realizada"
    cancelada = "cancelada"
    nao_compareceu = "nao_compareceu"


class ConsultaModalidade(str, enum.Enum):
    online = "Online"
    presencial = "Presencial"


class ConsultaSituacaoPagamento(str, enum.Enum):
    pago = "Pago"
    pendente = "Pendente"


class CobrancaStatusGateway(str, enum.Enum):
    awaiting_payment = "awaiting_payment"
    succeeded = "succeeded"
    failed = "failed"


class SessaoAoVivoFase(str, enum.Enum):
    patient_waiting = "patient_waiting"
    live = "live"
    ended = "ended"


class Paciente(Base):
    __tablename__ = "pacientes"
    __table_args__ = (Index("ix_pacientes_usuario_id", "usuario_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    contato_emergencia: Mapped[str | None] = mapped_column(Text, nullable=True)
    cpf: Mapped[str | None] = mapped_column(String(11), nullable=True)
    data_nascimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    cep: Mapped[str | None] = mapped_column(String(12), nullable=True)
    logradouro: Mapped[str | None] = mapped_column(String(255), nullable=True)
    numero: Mapped[str | None] = mapped_column(String(32), nullable=True)
    complemento: Mapped[str | None] = mapped_column(String(120), nullable=True)
    bairro: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cidade: Mapped[str | None] = mapped_column(String(120), nullable=True)
    uf: Mapped[str | None] = mapped_column(String(2), nullable=True)
    ponto_referencia: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    usuario = relationship("User")
    consultas = relationship("Consulta", back_populates="paciente")


class Psicologo(Base):
    __tablename__ = "psicologos"
    __table_args__ = (
        Index("ix_psicologos_usuario_id", "usuario_id"),
        Index("uq_psicologos_crp", "crp", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    crp: Mapped[str] = mapped_column(String(32), nullable=False)
    bio: Mapped[str] = mapped_column(Text, nullable=False, default="")
    valor_sessao_padrao: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    duracao_minutos_padrao: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=50)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    usuario = relationship("User")
    consultas = relationship("Consulta", back_populates="psicologo")
    disponibilidades = relationship("DisponibilidadeSemanal", back_populates="psicologo")
    bloqueios = relationship("BloqueioAgenda", back_populates="psicologo")


class Consulta(Base):
    __tablename__ = "consultas"
    __table_args__ = (
        Index("ix_consultas_paciente_data", "paciente_id", "data_agendada"),
        Index("ix_consultas_psicologo_data", "psicologo_id", "data_agendada"),
        Index("ix_consultas_status", "status"),
        Index(
            "uq_consultas_psicologo_inicio",
            "psicologo_id",
            "data_agendada",
            "hora_inicio",
            unique=True,
            postgresql_where=text("status NOT IN ('cancelada', 'nao_compareceu')"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paciente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pacientes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    psicologo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("psicologos.id", ondelete="RESTRICT"),
        nullable=False,
    )
    data_agendada: Mapped[date] = mapped_column(Date, nullable=False)
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    duracao_minutos: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=50)
    modalidade: Mapped[ConsultaModalidade] = mapped_column(
        Enum(ConsultaModalidade, name="consulta_modalidade", native_enum=True),
        nullable=False,
    )
    status: Mapped[ConsultaStatus] = mapped_column(
        Enum(ConsultaStatus, name="consulta_status", native_enum=True),
        nullable=False,
        default=ConsultaStatus.agendada,
    )
    situacao_pagamento: Mapped[ConsultaSituacaoPagamento] = mapped_column(
        Enum(ConsultaSituacaoPagamento, name="consulta_situacao_pagamento", native_enum=True),
        nullable=False,
        default=ConsultaSituacaoPagamento.pendente,
    )
    valor_acordado: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    especialidade_atendida: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    link_videochamada_opcional: Mapped[str | None] = mapped_column(Text, nullable=True)
    observacoes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    paciente = relationship("Paciente", back_populates="consultas")
    psicologo = relationship("Psicologo", back_populates="consultas")
    cobranca = relationship("Cobranca", back_populates="consulta", uselist=False)
    sessao_ao_vivo = relationship("SessaoAoVivo", back_populates="consulta", uselist=False)


class Cobranca(Base):
    __tablename__ = "cobrancas"
    __table_args__ = (
        Index("ix_cobrancas_status", "status_gateway"),
        Index("uq_cobrancas_intent", "id_intent_gateway", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consulta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consultas.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    valor_centavos: Mapped[int] = mapped_column(BIGINT, nullable=False)
    moeda: Mapped[str] = mapped_column(String(3), nullable=False, default="BRL")
    provedor_gateway: Mapped[str] = mapped_column(String(64), nullable=False, default="stripe_compatible_mock")
    id_intent_gateway: Mapped[str] = mapped_column(String(128), nullable=False)
    status_gateway: Mapped[CobrancaStatusGateway] = mapped_column(
        Enum(CobrancaStatusGateway, name="cobranca_status_gateway", native_enum=True),
        nullable=False,
        default=CobrancaStatusGateway.awaiting_payment,
    )
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    pago_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    consulta = relationship("Consulta", back_populates="cobranca")


class SessaoAoVivo(Base):
    __tablename__ = "sessoes_ao_vivo"
    __table_args__ = (Index("ix_sessoes_fase", "fase"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consulta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consultas.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    fase: Mapped[SessaoAoVivoFase] = mapped_column(
        Enum(SessaoAoVivoFase, name="sessao_ao_vivo_fase", native_enum=True),
        nullable=False,
        default=SessaoAoVivoFase.patient_waiting,
    )
    url_meet: Mapped[str | None] = mapped_column(Text, nullable=True)
    paciente_entrou_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    desbloqueio_play_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cronometro_iniciado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    encerrada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    consulta = relationship("Consulta", back_populates="sessao_ao_vivo")


class DisponibilidadeSemanal(Base):
    __tablename__ = "disponibilidade_semanal"
    __table_args__ = (
        CheckConstraint("dia_semana >= 0 AND dia_semana <= 6", name="ck_disponibilidade_dia_semana"),
        CheckConstraint("hora_fim > hora_inicio", name="ck_disponibilidade_janela"),
        Index("uq_disponibilidade_psicologo_dia", "psicologo_id", "dia_semana", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    psicologo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("psicologos.id", ondelete="CASCADE"),
        nullable=False,
    )
    dia_semana: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    hora_fim: Mapped[time] = mapped_column(Time, nullable=False)

    psicologo = relationship("Psicologo", back_populates="disponibilidades")


class BloqueioAgenda(Base):
    __tablename__ = "bloqueios_agenda"
    __table_args__ = (
        CheckConstraint(
            "dia_inteiro OR (hora_inicio IS NOT NULL AND hora_fim IS NOT NULL AND hora_fim > hora_inicio)",
            name="ck_bloqueios_janela",
        ),
        Index("ix_bloqueios_psicologo_data", "psicologo_id", "data_bloqueio"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    psicologo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("psicologos.id", ondelete="CASCADE"),
        nullable=False,
    )
    data_bloqueio: Mapped[date] = mapped_column(Date, nullable=False)
    dia_inteiro: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    hora_inicio: Mapped[time | None] = mapped_column(Time, nullable=True)
    hora_fim: Mapped[time | None] = mapped_column(Time, nullable=True)
    motivo: Mapped[str] = mapped_column(Text, nullable=False, default="")

    psicologo = relationship("Psicologo", back_populates="bloqueios")
