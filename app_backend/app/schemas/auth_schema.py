"""
Schemas Pydantic v2 — entradas e saídas públicas (nunca incluem senha em resposta).
"""

from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserRoleSchema(str, Enum):
    """Espelha `UserRole` para documentação OpenAPI."""

    patient = "patient"
    psychologist = "psychologist"
    admin = "admin"


class UserRegisterRequest(BaseModel):
    """POST /auth/register — cadastro de paciente (RF-001)."""

    name: str = Field(
        min_length=1,
        max_length=200,
        description="Nome completo",
        examples=["Maria Silva"],
    )
    email: EmailStr = Field(description="E-mail único", examples=["maria@example.com"])
    phone: str = Field(
        min_length=8,
        max_length=30,
        description="Telefone (com DDD)",
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

    @field_validator("phone", mode="before")
    @classmethod
    def _strip_phone(cls, v: object) -> object:
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
