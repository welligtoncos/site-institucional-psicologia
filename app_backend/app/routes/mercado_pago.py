"""
Rotas auxiliares do Mercado Pago (sanidade da configuração do SDK e preferências).
"""

import logging

from fastapi import APIRouter, HTTPException, Request, Response

from app.core.config import get_settings
from app.schemas.mercado_pago_schema import MercadoPagoPreferenciaItemRequest, MercadoPagoPreferenciaResponse
from app.services.mercado_pago_service import (
    MercadoPagoConfigurationError,
    MercadoPagoPreferenceApiError,
    MercadoPagoService,
)

router = APIRouter(prefix="/mercado-pago", tags=["mercado-pago"])
logger = logging.getLogger(__name__)


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


@router.post(
    "/preferencia",
    response_model=MercadoPagoPreferenciaResponse,
    summary="Cria preferência de pagamento (Checkout Pro / Wallet)",
    description="Usa o Access Token no servidor. Retorna ids e URLs para o frontend (`Wallet` + public key).",
)
def create_preferencia(body: MercadoPagoPreferenciaItemRequest) -> MercadoPagoPreferenciaResponse:
    settings = get_settings()
    notify = (settings.mercadopago_notification_url or "").strip() or None
    try:
        svc = MercadoPagoService()
    except MercadoPagoConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    try:
        return svc.create_checkout_preference(
            body,
            frontend_base_url=settings.frontend_url,
            notification_url=notify,
        )
    except MercadoPagoPreferenceApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.api_route(
    "/notifications",
    methods=["GET", "POST"],
    summary="Webhook / IPN do Mercado Pago",
    description=(
        "Chamado pelos servidores do Mercado Pago quando há mudança de pagamento. "
        "Deve ser URL pública HTTPS — não use localhost sem túnel (ngrok). Responda 200 rápido."
    ),
)
async def mercado_pago_notifications(request: Request) -> Response:
    query = dict(request.query_params)
    body = await request.body()
    logger.info(
        "Mercado Pago notification: method=%s query=%s body_len=%s",
        request.method,
        query,
        len(body),
    )
    return Response(status_code=200)
