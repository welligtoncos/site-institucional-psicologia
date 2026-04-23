"""
Integração com o SDK oficial do Mercado Pago (preferências, pagamentos).

Credenciais: use `MERCADO_PAGO_ACCESS_TOKEN` no ambiente (nunca versionar valores reais).
"""

from __future__ import annotations

import os

import mercadopago


class MercadoPagoConfigurationError(RuntimeError):
    """Token ou configuração obrigatória ausente para usar o SDK."""


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
