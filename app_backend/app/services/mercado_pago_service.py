"""
Integração com o SDK oficial do Mercado Pago (preferências, pagamentos).

Credenciais: use `MERCADO_PAGO_ACCESS_TOKEN` no ambiente (nunca versionar valores reais).
"""

from __future__ import annotations

import os
import secrets
from typing import Any

import mercadopago

from app.schemas.mercado_pago_schema import MercadoPagoPreferenciaItemRequest, MercadoPagoPreferenciaResponse


class MercadoPagoConfigurationError(RuntimeError):
    """Token ou configuração obrigatória ausente para usar o SDK."""


class MercadoPagoPreferenceApiError(RuntimeError):
    """Resposta de erro da API de preferências do Mercado Pago."""


def _resolve_access_token(*, explicit: str | None) -> str:
    raw = (explicit if explicit is not None else os.getenv("MERCADO_PAGO_ACCESS_TOKEN", "")).strip()
    if not raw:
        raise MercadoPagoConfigurationError(
            "A variável de ambiente MERCADO_PAGO_ACCESS_TOKEN não está configurada ou está vazia. "
            "Copie app_backend/.env.example para .env e defina um Access Token de teste ou produção "
            "(Dashboard Mercado Pago → Credenciais)."
        )
    return raw


class MercadoPagoService:
    """
    Ponto central para chamadas ao SDK; evolua aqui com métodos de preferência e pagamento.
    """

    def __init__(self, *, access_token: str | None = None) -> None:
        token = _resolve_access_token(explicit=access_token)
        self.sdk = mercadopago.SDK(token)

    def create_checkout_preference(
        self,
        item: MercadoPagoPreferenciaItemRequest,
        *,
        frontend_base_url: str,
        notification_url: str | None = None,
    ) -> MercadoPagoPreferenciaResponse:
        """
        Cria preferência Checkout Pro (items + back_urls + external_reference).
        O valor vem do request (`unit_price`), alinhado ao preço do profissional no frontend.
        """
        base = frontend_base_url.strip().rstrip("/")
        if not base.lower().startswith(("http://", "https://")):
            raise MercadoPagoPreferenceApiError(
                "FRONTEND_URL deve ser uma URL absoluta (ex.: https://www.seu-site.com ou http://127.0.0.1:3000)."
            )

        order_id = item.order_id if item.order_id is not None else _generate_order_id()
        external_reference = str(order_id)

        preference_data: dict[str, Any] = {
            "items": [
                {
                    "title": item.title[:256],
                    "quantity": item.quantity,
                    "unit_price": round(float(item.unit_price), 2),
                    "currency_id": "BRL",
                }
            ],
            "back_urls": {
                "success": f"{base}/payment/success",
                "failure": f"{base}/payment/failure",
                "pending": f"{base}/payment/pending",
            },
            "external_reference": external_reference,
        }
        # auto_return exige back_urls válidas; com http://localhost o MP costuma retornar
        # 400 invalid_auto_return. Com HTTPS em produção, o redirecionamento após aprovação é automático.
        if base.lower().startswith("https://"):
            preference_data["auto_return"] = "approved"

        if notification_url and notification_url.strip():
            preference_data["notification_url"] = notification_url.strip().rstrip("/")

        result = self.sdk.preference().create(preference_data)
        status = result.get("status")
        body = result.get("response")
        if status not in (200, 201) or not isinstance(body, dict):
            msg = _format_preference_error(result)
            raise MercadoPagoPreferenceApiError(msg)
        pref_id = body.get("id")
        if not pref_id or not isinstance(pref_id, str):
            raise MercadoPagoPreferenceApiError("Resposta do Mercado Pago sem id de preferência.")
        init_point = body.get("init_point")
        if not init_point or not isinstance(init_point, str):
            init_point = ""
        sandbox = body.get("sandbox_init_point")
        sandbox_init = sandbox if isinstance(sandbox, str) else None
        return MercadoPagoPreferenciaResponse(
            preference_id=pref_id,
            init_point=init_point,
            sandbox_init_point=sandbox_init,
        )


def _generate_order_id() -> int:
    """Inteiro positivo quando o cliente não envia order_id (evita colisão trivial)."""
    return secrets.randbelow(2_147_000_000) + 1


def _format_preference_error(result: dict[str, Any]) -> str:
    """Extrai texto útil da resposta do SDK (status ≠ 201)."""
    status = result.get("status")
    resp = result.get("response")
    parts: list[str] = []
    if status is not None:
        parts.append(f"HTTP {status}")

    if isinstance(resp, dict):
        message = resp.get("message")
        if isinstance(message, str) and message.strip():
            parts.append(message.strip())
        err = resp.get("error")
        if isinstance(err, str) and err.strip():
            parts.append(err.strip())
        cause = resp.get("cause")
        if isinstance(cause, list):
            for c in cause:
                if isinstance(c, dict):
                    desc = c.get("description")
                    code = c.get("code")
                    if isinstance(desc, str) and desc.strip():
                        parts.append(f"{desc.strip()}" + (f" [{code}]" if code else ""))
                elif isinstance(c, str) and c.strip():
                    parts.append(c.strip())

    if len(parts) > 1:
        return "Mercado Pago: " + " — ".join(parts)
    if len(parts) == 1:
        return "Mercado Pago: " + parts[0]
    return "Falha ao criar preferência no Mercado Pago (resposta vazia)."
