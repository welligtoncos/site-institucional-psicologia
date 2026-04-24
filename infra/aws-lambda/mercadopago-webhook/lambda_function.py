"""
Webhook Mercado Pago para AWS Lambda (API Gateway).

Variáveis na função:
  MERCADO_PAGO_ACCESS_TOKEN — consultar pagamento na API MP
  MERCADO_PAGO_CONFIRM_PAYMENT_URL — POST HTTPS no FastAPI (ex.: .../internal/mercadopago/confirm-payment)
  MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET — mesmo valor do app_backend (header X-Internal-Webhook-Secret)
"""

import json
import os
import urllib.error
import urllib.request
import uuid

MERCADO_PAGO_ACCESS_TOKEN = os.environ.get("MERCADO_PAGO_ACCESS_TOKEN")
CONFIRM_PAYMENT_URL = os.environ.get("MERCADO_PAGO_CONFIRM_PAYMENT_URL", "").strip()
INTERNAL_WEBHOOK_SECRET = os.environ.get("MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET", "").strip()


def lambda_handler(event, context):
    print("Evento recebido:", json.dumps(event))

    try:
        body = {}
        if event.get("body"):
            body = json.loads(event.get("body") or "{}")

        query_params = event.get("queryStringParameters") or {}

        print("Body recebido:", body)
        print("Query params:", query_params)

        event_type = (
            body.get("type")
            or query_params.get("type")
            or query_params.get("topic")
        )

        payment_id = (
            body.get("data", {}).get("id")
            or query_params.get("data.id")
            or query_params.get("id")
        )

        if event_type != "payment":
            return response(200, {
                "message": "Evento ignorado",
                "type": event_type
            })

        if not payment_id:
            return response(400, {
                "message": "payment_id não encontrado"
            })

        payment = buscar_pagamento_mercado_pago(payment_id)

        status = payment.get("status")
        status_detail = payment.get("status_detail")
        external_reference = payment.get("external_reference")
        transaction_amount = payment.get("transaction_amount")
        payment_type_id = payment.get("payment_type_id")

        print("Pagamento consultado no Mercado Pago")
        print("Payment ID:", payment_id)
        print("Status:", status)
        print("Status detail:", status_detail)
        print("Pedido interno:", external_reference)
        print("Valor:", transaction_amount)
        print("Tipo de pagamento:", payment_type_id)

        status_interno = mapear_status(status)

        persistido = False
        persist_erro = None
        if status == "approved" and external_reference:
            persistido, persist_erro = persistir_pagamento_no_backend(
                external_reference, payment_id, status
            )

        body_ok = {
            "message": "Webhook Mercado Pago processado com sucesso",
            "payment_id": payment_id,
            "status_mercado_pago": status,
            "status_interno": status_interno,
            "external_reference": external_reference,
            "persistido_bd": persistido,
        }
        if persist_erro:
            body_ok["persist_erro"] = persist_erro

        return response(200, body_ok)

    except Exception as erro:
        print("Erro ao processar webhook:", str(erro))

        return response(500, {
            "message": "Erro interno ao processar webhook",
            "error": str(erro)
        })


def buscar_pagamento_mercado_pago(payment_id):
    if not MERCADO_PAGO_ACCESS_TOKEN:
        raise Exception("MERCADO_PAGO_ACCESS_TOKEN não configurado")

    url = f"https://api.mercadopago.com/v1/payments/{payment_id}"

    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {MERCADO_PAGO_ACCESS_TOKEN}",
            "Content-Type": "application/json"
        },
        method="GET"
    )

    try:
        with urllib.request.urlopen(req) as res:
            data = res.read().decode("utf-8")
            return json.loads(data)

    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print("Erro Mercado Pago:", error_body)

        # No teste do Mercado Pago, ele pode enviar um ID fictício.
        # Então, se for Payment not found, respondemos 200 para provar que o endpoint recebeu.
        if e.code == 404:
            return {
                "id": payment_id,
                "status": "not_found",
                "status_detail": "payment_not_found",
                "external_reference": None,
                "transaction_amount": None,
                "payment_type_id": None
            }

        raise Exception(f"Erro ao consultar pagamento no Mercado Pago: {error_body}")


def mapear_status(status):
    if status == "approved":
        return "PAGO"

    if status == "pending":
        return "PENDENTE"

    if status == "rejected":
        return "RECUSADO"

    if status == "cancelled":
        return "CANCELADO"

    if status == "refunded":
        return "REEMBOLSADO"

    if status == "not_found":
        return "PAGAMENTO_NAO_ENCONTRADO_TESTE"

    return "DESCONHECIDO"


def persistir_pagamento_no_backend(external_reference, payment_id, status_mp):
    """
    Grava pagamento no PostgreSQL via FastAPI (somente se external_reference for UUID da consulta).
    Retorna (sucesso_bool, mensagem_erro_ou_None).
    """
    if not CONFIRM_PAYMENT_URL or not INTERNAL_WEBHOOK_SECRET:
        return False, (
            "MERCADO_PAGO_CONFIRM_PAYMENT_URL ou MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET não configurados na Lambda"
        )

    try:
        uuid.UUID(str(external_reference))
    except (ValueError, TypeError):
        return False, "external_reference não é UUID — use consulta_id na preferência"

    payload = json.dumps(
        {
            "consulta_id": str(external_reference),
            "payment_id": str(payment_id),
            "status": str(status_mp),
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        CONFIRM_PAYMENT_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Internal-Webhook-Secret": INTERNAL_WEBHOOK_SECRET,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            raw = res.read().decode("utf-8")
            code = getattr(res, "status", None) or res.getcode()
            if code != 200:
                return False, f"backend HTTP {code}: {raw[:500]}"
            return True, None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        return False, f"backend HTTP {e.code}: {err_body[:500]}"
    except Exception as exc:
        return False, str(exc)[:500]


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(body)
    }
