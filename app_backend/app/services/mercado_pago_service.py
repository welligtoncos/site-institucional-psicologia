"""
Integração com o SDK oficial do Mercado Pago (preferências, pagamentos).

Credenciais: use `MERCADO_PAGO_ACCESS_TOKEN` no ambiente (nunca versionar valores reais).
"""

from __future__ import annotations

import os
import secrets
from typing import Any
from urllib.parse import urlparse

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

        if item.consulta_id is not None:
            external_reference = str(item.consulta_id)
        else:
            order_id = item.order_id if item.order_id is not None else _generate_order_id()
            external_reference = str(order_id)

        parsed_base = urlparse(base)
        is_https = parsed_base.scheme.lower() == "https"
        is_local_http = parsed_base.scheme.lower() == "http" and parsed_base.hostname in {"localhost", "127.0.0.1"}

        preference_data: dict[str, Any] = {
            "items": [
                {
                    "title": item.title[:256],
                    "quantity": item.quantity,
                    "unit_price": round(float(item.unit_price), 2),
                    "currency_id": "BRL",
                }
            ],
            "external_reference": external_reference,
        }
        # Em produção, prefira HTTPS com back_urls configuradas.
        # Em HTTP público (ex.: IP sem TLS), algumas políticas do MP podem negar a criação da preferência.
        # Nesses casos, mantemos o checkout sem back_urls até habilitar domínio HTTPS.
        if is_https or is_local_http:
            preference_data["back_urls"] = {
                "success": f"{base}/payment/success",
                "failure": f"{base}/payment/failure",
                "pending": f"{base}/payment/pending",
            }
        # auto_return exige back_urls válidas; com http://localhost o MP costuma retornar
        # 400 invalid_auto_return. Com HTTPS em produção, o redirecionamento após aprovação é automático.
        if is_https:
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

    def get_payment(self, payment_id: str) -> dict[str, Any]:
        """
        Consulta um pagamento na API oficial (GET payment).
        Use no servidor para confirmar status após retorno do checkout ou reconciliar com webhooks.
        """
        raw = str(payment_id).strip()
        if not raw or not raw.isdigit():
            raise MercadoPagoPreferenceApiError("payment_id inválido (esperado numérico do Mercado Pago).")
        result = self.sdk.payment().get(raw)
        status = result.get("status")
        body = result.get("response")
        if status != 200 or not isinstance(body, dict):
            msg = _format_payment_fetch_error(result)
            raise MercadoPagoPreferenceApiError(msg)
        return body


def _generate_order_id() -> int:
    """Inteiro positivo quando o cliente não envia order_id (evita colisão trivial)."""
    return secrets.randbelow(2_147_000_000) + 1


def _format_payment_fetch_error(result: dict[str, Any]) -> str:
    """Extrai texto útil quando GET payment falha."""
    status = result.get("status")
    resp = result.get("response")
    parts: list[str] = []
    if status is not None:
        parts.append(f"HTTP {status}")
    if isinstance(resp, dict):
        message = resp.get("message")
        if isinstance(message, str) and message.strip():
            parts.append(message.strip())
    if parts:
        return "Mercado Pago (pagamento): " + " — ".join(parts)
    return "Não foi possível consultar o pagamento no Mercado Pago."


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
