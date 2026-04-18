"""Schemas para perfis clínicos (endpoints autenticados /profiles)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.auth_schema import UserResponse


class PacienteProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    usuario_id: UUID
    contato_emergencia: str | None
    criado_em: datetime


class PsicologoProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    usuario_id: UUID
    crp: str
    bio: str
    valor_sessao_padrao: Decimal
    duracao_minutos_padrao: int
    criado_em: datetime


class PatientMeResponse(BaseModel):
    user: UserResponse
    paciente: PacienteProfileResponse


class PsychologistMeResponse(BaseModel):
    user: UserResponse
    psicologo: PsicologoProfileResponse


class PatientListResponse(BaseModel):
    """Resposta paginada — uso em GET administrativo."""

    items: list[PatientMeResponse]
    skip: int
    limit: int


class PsychologistListResponse(BaseModel):
    items: list[PsychologistMeResponse]
    skip: int
    limit: int


class PatientProfilePatchRequest(BaseModel):
    contato_emergencia: str | None = Field(default=None, max_length=5000)


class PsychologistProfilePatchRequest(BaseModel):
    bio: str | None = Field(default=None, max_length=8000)
    valor_sessao_padrao: Decimal | None = Field(default=None, ge=0)
    duracao_minutos_padrao: int | None = Field(default=None, ge=15, le=240)

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "PsychologistProfilePatchRequest":
        if self.bio is None and self.valor_sessao_padrao is None and self.duracao_minutos_padrao is None:
            raise ValueError("Informe ao menos um campo para atualizar (bio, valor_sessao_padrao ou duracao_minutos_padrao).")
        return self
