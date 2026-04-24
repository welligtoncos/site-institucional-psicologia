"""
Webhook Mercado Pago para AWS Lambda (API Gateway).

Variável de ambiente na função: MERCADO_PAGO_ACCESS_TOKEN
"""

import json
import os
import urllib.request
import urllib.error

MERCADO_PAGO_ACCESS_TOKEN = os.environ.get("MERCADO_PAGO_ACCESS_TOKEN")


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

        return response(200, {
            "message": "Webhook Mercado Pago processado com sucesso",
            "payment_id": payment_id,
            "status_mercado_pago": status,
            "status_interno": status_interno,
            "external_reference": external_reference
        })

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


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(body)
    }
