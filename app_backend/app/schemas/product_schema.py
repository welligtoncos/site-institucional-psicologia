"""
Schemas de produto para criação, atualização e resposta pública.
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProductCreateRequest(BaseModel):
    nome: str = Field(min_length=1, max_length=200, examples=["Notebook Pro 14"])
    descricao: str = Field(default="", max_length=2000, examples=["16GB RAM, 512GB SSD"])
    preco: Decimal = Field(gt=0, decimal_places=2, max_digits=12, examples=[5999.90])
    quantidade: int = Field(ge=0, examples=[10])
    ativo: bool = Field(default=True)


class ProductUpdateRequest(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=200)
    descricao: str | None = Field(default=None, max_length=2000)
    preco: Decimal | None = Field(default=None, gt=0, decimal_places=2, max_digits=12)
    quantidade: int | None = Field(default=None, ge=0)
    ativo: bool | None = None

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "ProductUpdateRequest":
        if (
            self.nome is None
            and self.descricao is None
            and self.preco is None
            and self.quantidade is None
            and self.ativo is None
        ):
            raise ValueError("Informe ao menos um campo para atualização.")
        return self


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nome: str
    descricao: str
    preco: Decimal
    quantidade: int
    ativo: bool
    created_at: datetime
    updated_at: datetime
