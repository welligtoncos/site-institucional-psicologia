"""Schemas HTTP — preferências Checkout Pro / Wallet."""

from pydantic import BaseModel, Field


class MercadoPagoPreferenciaItemRequest(BaseModel):
    """Corpo esperado pelo frontend ao criar preferência (item único de exemplo)."""

    order_id: int | None = Field(
        default=None,
        ge=1,
        description="ID do pedido no seu sistema; se omitido, o backend gera um inteiro.",
    )
    title: str = Field(..., min_length=1, max_length=256)
    quantity: int = Field(..., ge=1, le=999)
    unit_price: float = Field(..., gt=0, le=1_000_000)


class MercadoPagoPreferenciaResponse(BaseModel):
    preference_id: str
    init_point: str
    sandbox_init_point: str | None = None
