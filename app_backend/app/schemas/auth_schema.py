"""
Schemas Pydantic v2 — entradas e saídas públicas (nunca incluem senha em resposta).
"""

from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class UserRoleSchema(str, Enum):
    """Espelha `UserRole` para documentação OpenAPI."""

    patient = "patient"
    psychologist = "psychologist"
    admin = "admin"


class UserRegisterRequest(BaseModel):
    """POST /auth/register — cadastro de paciente (RF-001)."""

    name: str = Field(
        default="",
        max_length=200,
        description="Nome completo; pode ser vazio no cadastro e preenchido depois no perfil.",
        examples=["Maria Silva"],
    )
    email: EmailStr = Field(description="E-mail único", examples=["maria@example.com"])
    phone: str = Field(
        default="",
        max_length=30,
        description="Telefone opcional (com DDD); se informado, use pelo menos 8 caracteres.",
        examples=["11999998888"],
    )
    password: str = Field(
        min_length=8,
        description="Senha em texto (mín. 8 caracteres); persistida apenas como hash",
        examples=["SenhaSegura123"],
    )
    accept_terms: Literal[True] = Field(
        ...,
        description="Deve ser true: aceite dos termos de uso e da política de privacidade.",
    )
    contato_emergencia: str | None = Field(
        default=None,
        max_length=5000,
        description="Contato de emergência (RF perfil paciente); opcional no cadastro.",
    )

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, v: object) -> object:
        if v is None:
            return ""
        if isinstance(v, str):
            return v.strip()[:200]
        return v

    @field_validator("phone", mode="before")
    @classmethod
    def _strip_phone(cls, v: object) -> object:
        if v is None:
            return ""
        if isinstance(v, str):
            return v.strip()
        return v

    @model_validator(mode="after")
    def _phone_len_if_informed(self) -> "UserRegisterRequest":
        if self.phone and len(self.phone) < 8:
            raise ValueError("Telefone deve ter pelo menos 8 caracteres se informado.")
        return self

    @field_validator("contato_emergencia", mode="before")
    @classmethod
    def _strip_contato(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s or None
        return v


class PsychologistRegisterRequest(BaseModel):
    """POST /auth/register/psychologist — cadastro de psicólogo + linha em `psicologos`."""

    name: str = Field(min_length=1, max_length=200, examples=["Dr. João Souza"])
    email: EmailStr = Field(examples=["joao@example.com"])
    phone: str = Field(min_length=8, max_length=30, examples=["11988887777"])
    password: str = Field(min_length=8, examples=["SenhaSegura123"])
    accept_terms: Literal[True] = Field(
        ...,
        description="Aceite dos termos de uso e da política de privacidade.",
    )
    crp: str = Field(min_length=5, max_length=32, examples=["06/123456-SP"])
    bio: str = Field(default="", max_length=8000, description="Apresentação profissional")
    valor_sessao_padrao: Decimal | None = Field(
        default=None,
        description="Valor padrão da sessão; se omitido, usa 0 (configure depois no perfil).",
    )
    duracao_minutos_padrao: int | None = Field(
        default=None,
        ge=15,
        le=240,
        description="Duração padrão em minutos; se omitido, usa 50.",
    )

    @field_validator("phone", "crp", mode="before")
    @classmethod
    def _strip(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v


class UserLoginRequest(BaseModel):
    """POST /auth/login — credenciais."""

    email: EmailStr = Field(examples=["maria@example.com"])
    password: str = Field(examples=["SenhaSegura123"])


class RefreshTokenRequest(BaseModel):
    """POST /auth/refresh — token de renovação."""

    refresh_token: str = Field(
        min_length=10,
        description="JWT refresh token recebido no login",
    )


class UserResponse(BaseModel):
    """Usuário sem campo de senha."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: EmailStr
    phone: str
    role: UserRoleSchema
    is_active: bool
    terms_accepted_at: datetime | None
    created_at: datetime

    @field_validator("role", mode="before")
    @classmethod
    def _coerce_role(cls, v: object) -> object:
        """Aceita enum ORM `UserRole` ou string."""
        if hasattr(v, "value"):
            return v.value
        return v


class TokenResponse(BaseModel):
    """Par de tokens após login."""

    access_token: str = Field(description="JWT de acesso", examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6..."])
    refresh_token: str = Field(description="JWT de renovação", examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6..."])
    token_type: str = Field(default="bearer", description="Esquema Authorization (RFC 6750)", examples=["bearer"])
