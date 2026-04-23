"""
Rotas auxiliares do Mercado Pago (sanidade da configuração do SDK).
"""

from fastapi import APIRouter, HTTPException

from app.services.mercado_pago_service import MercadoPagoConfigurationError, MercadoPagoService

router = APIRouter(prefix="/mercado-pago", tags=["mercado-pago"])


@router.get(
    "/status",
    summary="Verifica se o SDK Mercado Pago está configurado",
    description="Confere `MERCADO_PAGO_ACCESS_TOKEN` e instancia o SDK. Não cria pagamento.",
)
def mercado_pago_status() -> dict[str, str]:
    try:
        MercadoPagoService()
    except MercadoPagoConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"message": "SDK Mercado Pago configurado com sucesso"}
