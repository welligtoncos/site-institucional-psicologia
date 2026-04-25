"""
Consumer SQS de pagamentos Mercado Pago para AWS Lambda.

Responsabilidade:
  - Ler mensagens da fila `mp-webhook-inbound`
  - Normalizar o payload
  - Chamar o backend FastAPI em /internal/mercadopago/confirm-payment
  - Falhar apenas os itens com erro para reprocessamento (partial batch response)

Variáveis de ambiente:
  MERCADO_PAGO_CONFIRM_PAYMENT_URL
  MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET
"""

import json
import os
import urllib.error
import urllib.request
from typing import Any

CONFIRM_PAYMENT_URL = os.environ.get("MERCADO_PAGO_CONFIRM_PAYMENT_URL", "").strip()
INTERNAL_WEBHOOK_SECRET = os.environ.get("MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET", "").strip()


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, list[dict[str, str]]]:
    records = event.get("Records") or []
    failures: list[dict[str, str]] = []

    for record in records:
        message_id = str(record.get("messageId") or "")
        try:
            payload = _parse_body(record)
            normalized = _normalize_payload(payload)

            if normalized["status"].lower() != "approved":
                print(
                    "Mensagem ignorada (status nao aprovado):",
                    {"message_id": message_id, "status": normalized["status"]},
                )
                continue

            _post_confirm_payment(normalized)
            print(
                "Pagamento confirmado no backend",
                {
                    "message_id": message_id,
                    "consulta_id": normalized["consulta_id"],
                    "payment_id": normalized["payment_id"],
                },
            )
        except Exception as exc:
            print("Falha ao processar mensagem SQS", {"message_id": message_id, "error": str(exc)})
            if message_id:
                failures.append({"itemIdentifier": message_id})

    return {"batchItemFailures": failures}


def _parse_body(record: dict[str, Any]) -> dict[str, Any]:
    body_raw = record.get("body")
    if not isinstance(body_raw, str) or not body_raw.strip():
        raise ValueError("Mensagem SQS sem body")

    try:
        body = json.loads(body_raw)
    except json.JSONDecodeError as exc:
        raise ValueError("Body da mensagem nao e JSON valido") from exc

    if not isinstance(body, dict):
        raise ValueError("Body da mensagem deve ser objeto JSON")

    return body


def _normalize_payload(payload: dict[str, Any]) -> dict[str, str]:
    consulta_id = str(
        payload.get("consulta_id")
        or payload.get("external_reference")
        or payload.get("appointment_id")
        or ""
    ).strip()
    payment_id = str(payload.get("payment_id") or payload.get("id") or "").strip()
    status = str(payload.get("status") or "").strip()

    if not consulta_id:
        raise ValueError("consulta_id/external_reference ausente")
    if not payment_id:
        raise ValueError("payment_id ausente")
    if not status:
        raise ValueError("status ausente")

    return {"consulta_id": consulta_id, "payment_id": payment_id, "status": status}


def _post_confirm_payment(data: dict[str, str]) -> None:
    if not CONFIRM_PAYMENT_URL:
        raise RuntimeError("MERCADO_PAGO_CONFIRM_PAYMENT_URL nao configurada")
    if not INTERNAL_WEBHOOK_SECRET:
        raise RuntimeError("MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET nao configurada")

    payload = json.dumps(data).encode("utf-8")
    request = urllib.request.Request(
        CONFIRM_PAYMENT_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Internal-Webhook-Secret": INTERNAL_WEBHOOK_SECRET,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status_code = getattr(response, "status", None) or response.getcode()
            response_body = response.read().decode("utf-8", errors="replace")
            if status_code != 200:
                raise RuntimeError(f"Backend retornou HTTP {status_code}: {response_body[:300]}")
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Backend retornou HTTP {exc.code}: {err_body[:300]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Falha de rede ao chamar backend: {exc.reason}") from exc
