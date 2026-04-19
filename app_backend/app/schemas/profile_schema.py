"""Schemas para perfis clínicos (endpoints autenticados /profiles)."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.cpf import parse_and_validate_cpf
from app.schemas.auth_schema import UserResponse


class PacienteProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    usuario_id: UUID
    contato_emergencia: str | None
    cpf: str | None
    data_nascimento: date | None
    cep: str | None
    logradouro: str | None
    numero: str | None
    complemento: str | None
    bairro: str | None
    cidade: str | None
    uf: str | None
    ponto_referencia: str | None
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
    """Obrigatórios: nome, telefone e CPF. Demais campos são opcionais."""

    name: str = Field(..., min_length=1, max_length=200, description="Nome completo do paciente")
    phone: str = Field(..., min_length=8, max_length=30, description="Telefone com DDD")
    cpf: str = Field(..., description="CPF (11 dígitos, com ou sem máscara)")

    contato_emergencia: str | None = Field(default=None, max_length=5000)
    data_nascimento: date | None = None
    cep: str | None = Field(default=None, max_length=12)
    logradouro: str | None = Field(default=None, max_length=255)
    numero: str | None = Field(default=None, max_length=32)
    complemento: str | None = Field(default=None, max_length=120)
    bairro: str | None = Field(default=None, max_length=120)
    cidade: str | None = Field(default=None, max_length=120)
    uf: str | None = Field(default=None, min_length=2, max_length=2)
    ponto_referencia: str | None = Field(default=None, max_length=8000)

    @field_validator("name", "phone", mode="before")
    @classmethod
    def _strip_name_phone(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("cpf", mode="before")
    @classmethod
    def _normalize_cpf(cls, v: object) -> str:
        if v is None or (isinstance(v, str) and not v.strip()):
            msg = "CPF é obrigatório."
            raise ValueError(msg)
        return parse_and_validate_cpf(str(v))

    @field_validator(
        "cep",
        "logradouro",
        "numero",
        "complemento",
        "bairro",
        "cidade",
        "contato_emergencia",
        "ponto_referencia",
        mode="before",
    )
    @classmethod
    def _strip_optional_str(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return str(v)

    @field_validator("uf", mode="before")
    @classmethod
    def _uf(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        s = str(v).strip().upper()[:2]
        if len(s) != 2 or not s.isalpha():
            msg = "UF deve ter 2 letras."
            raise ValueError(msg)
        return s

    @field_validator("data_nascimento", mode="before")
    @classmethod
    def _birth(cls, v: object) -> date | None:
        if v is None:
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            try:
                return date.fromisoformat(v.strip()[:10])
            except ValueError as exc:
                msg = "data_nascimento inválida."
                raise ValueError(msg) from exc
        msg = "data_nascimento inválida."
        raise ValueError(msg)

    @model_validator(mode="after")
    def _birth_reasonable(self) -> "PatientProfilePatchRequest":
        d = self.data_nascimento
        if d is None:
            return self
        today = date.today()
        if d > today:
            raise ValueError("Data de nascimento não pode ser futura.")
        if d.year < 1900:
            raise ValueError("Data de nascimento inválida.")
        return self


class PsychologistProfilePatchRequest(BaseModel):
    bio: str | None = Field(default=None, max_length=8000)
    valor_sessao_padrao: Decimal | None = Field(default=None, ge=0)
    duracao_minutos_padrao: int | None = Field(default=None, ge=15, le=240)

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "PsychologistProfilePatchRequest":
        if self.bio is None and self.valor_sessao_padrao is None and self.duracao_minutos_padrao is None:
            raise ValueError("Informe ao menos um campo para atualizar (bio, valor_sessao_padrao ou duracao_minutos_padrao).")
        return self
