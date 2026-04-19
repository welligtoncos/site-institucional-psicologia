"""Catálogo público de profissionais (paciente autenticado)."""

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


def parse_especialidades_csv(raw: str | None) -> list[str]:
    if not raw or not str(raw).strip():
        return []
    return [p.strip() for p in str(raw).split(",") if p.strip()]


class PsychologistCatalogItem(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: UUID = Field(description="ID do registro em psicologos (uso em agendamento)")
    nome: str
    crp: str
    bio: str
    valor_consulta: Decimal
    duracao_minutos: int
    foto_url: str | None = None
    especialidades: list[str] = Field(default_factory=list)


class WeeklyTemplateItem(BaseModel):
    """Intervalo da semana tipo (cadastro do psicólogo), para conferência no portal do paciente."""

    weekday: int = Field(ge=0, le=6, description="0=domingo … 6=sábado")
    weekday_label: str
    ativo: bool
    start: str = Field(description="HH:MM")
    end: str = Field(description="HH:MM")


class BookableDayItem(BaseModel):
    """Dia civil (America/Sao_Paulo) com inícios livres HH:MM."""

    date: str = Field(description="AAAA-MM-DD (calendário civil, fuso America/Sao_Paulo)")
    weekday: int = Field(ge=0, le=6, description="0=domingo … 6=sábado (mesmo critério do cadastro)")
    weekday_label: str
    slots: list[str] = Field(default_factory=list)


class PsychologistBookableSlotsResponse(BaseModel):
    """Perfil resumido + grade de horários para o paciente agendar."""

    id: UUID
    nome: str
    crp: str
    valor_consulta: Decimal
    duracao_minutos: int
    especialidades: list[str] = Field(default_factory=list)
    weekly_template: list[WeeklyTemplateItem] = Field(
        default_factory=list,
        description="Semana tipo salva no banco (referência). Os slots por dia já aplicam isso, bloqueios e consultas ativas.",
    )
    days: list[BookableDayItem] = Field(default_factory=list)
