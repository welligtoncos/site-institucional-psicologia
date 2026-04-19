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
