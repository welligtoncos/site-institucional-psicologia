"""
Schemas Pydantic v2 — entradas e saídas públicas (nunca incluem senha em resposta).
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserRoleSchema(str, Enum):
    """Espelha `UserRole` para documentação OpenAPI."""

    admin = "admin"
    user = "user"


class UserRegisterRequest(BaseModel):
    """POST /auth/register — corpo da requisição."""

    name: str = Field(
        min_length=1,
        max_length=200,
        description="Nome de exibição",
        examples=["Maria Silva"],
    )
    email: EmailStr = Field(description="E-mail único", examples=["maria@example.com"])
    password: str = Field(
        min_length=8,
        description="Senha em texto (mín. 8 caracteres); persistida apenas como hash",
        examples=["SenhaSegura123"],
    )


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
    role: UserRoleSchema
    is_active: bool
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
