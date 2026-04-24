"""
Rotas internas do Mercado Pago — só para Lambda ou serviços com segredo compartilhado.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import ConflictError, NotFoundError
from app.repositories.clinical_repository import ClinicalRepository
from app.schemas.mercado_pago_schema import MercadoPagoConfirmPaymentRequest

router = APIRouter(prefix="/internal/mercadopago", tags=["mercadopago-internal"])


@router.get(
    "/confirm-payment",
    summary="Ajuda (GET) — o registro no BD é via POST",
    include_in_schema=False,
)
def confirm_mercadopago_payment_get_hint() -> dict[str, str]:
    """Evita 405 no navegador/ngrok ao testar a URL; a Lambda e o backend usam POST."""
    return {
        "detail": "Use POST com Content-Type: application/json, header X-Internal-Webhook-Secret e corpo "
        "{ consulta_id, payment_id, status }. GET não grava no banco.",
    }


def verify_internal_webhook_secret(
    x_internal_webhook_secret: Annotated[str | None, Header(alias="X-Internal-Webhook-Secret")] = None,
) -> None:
    settings = get_settings()
    expected = (settings.mercadopago_internal_webhook_secret or "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET não configurado no servidor.",
        )
    received = (x_internal_webhook_secret or "").strip()
    if received != expected:
        raise HTTPException(status_code=401, detail="Credencial de webhook inválida.")


@router.post(
    "/confirm-payment",
    summary="Persiste pagamento aprovado (Mesmo efeito do simular pagamento, com dados MP)",
    description=(
        "Exige header X-Internal-Webhook-Secret igual a MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET. "
        "consulta_id deve ser o mesmo enviado como external_reference na preferência."
    ),
)
async def confirm_mercadopago_payment(
    body: MercadoPagoConfirmPaymentRequest,
    _: None = Depends(verify_internal_webhook_secret),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if body.status.lower() != "approved":
        return {"ok": True, "skipped": True, "reason": "status_not_approved"}

    repo = ClinicalRepository(db)
    link = f"https://meet.exemplo.com/{body.consulta_id}"
    try:
        await repo.mark_payment_success_for_consulta(
            body.consulta_id,
            default_video_link=link,
            mercadopago_payment_id=body.payment_id,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ConflictError as exc:
        msg = str(exc)
        if "já registrado" in msg or "Pagamento já" in msg:
            return {"ok": True, "idempotent": True}
        raise HTTPException(status_code=409, detail=msg) from exc

    return {"ok": True, "saved": True}
