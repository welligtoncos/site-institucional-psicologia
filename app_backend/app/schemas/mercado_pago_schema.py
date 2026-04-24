"""Schemas HTTP — preferências Checkout Pro / Wallet."""

from uuid import UUID

from pydantic import BaseModel, Field


class MercadoPagoPreferenciaItemRequest(BaseModel):
    """Corpo esperado pelo frontend ao criar preferência (item único de exemplo)."""

    consulta_id: UUID | None = Field(
        default=None,
        description="Se informado, vira external_reference no MP e permite vincular webhook ao BD.",
    )
    order_id: int | None = Field(
        default=None,
        ge=1,
        description="ID numérico alternativo; ignorado se consulta_id estiver definido.",
    )
    title: str = Field(..., min_length=1, max_length=256)
    quantity: int = Field(..., ge=1, le=999)
    unit_price: float = Field(..., gt=0, le=1_000_000)


class MercadoPagoPreferenciaResponse(BaseModel):
    preference_id: str
    init_point: str
    sandbox_init_point: str | None = None


class MercadoPagoConfirmPaymentRequest(BaseModel):
    """Corpo para confirmação segura no BD (Lambda → FastAPI). `consulta_id` deve igualar `external_reference` da preferência."""

    consulta_id: UUID
    payment_id: str = Field(..., min_length=1, max_length=128)
    status: str = Field(..., description="approved, pending, rejected, etc.")


class MercadoPagoSyncReturnRequest(BaseModel):
    """Paciente retornando do Checkout Pro — consulta status no MP no servidor e atualiza o BD."""

    payment_id: str = Field(..., min_length=1, max_length=40, description="Mesmo enviado pelo MP na URL de retorno")


class MercadoPagoSyncReturnResponse(BaseModel):
    synced: bool
    already_registered: bool = False
    detail: str | None = None
