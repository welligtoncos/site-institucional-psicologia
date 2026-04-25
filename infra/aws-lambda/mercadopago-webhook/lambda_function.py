"""
Webhook Mercado Pago para AWS Lambda (API Gateway -> SQS).

Variáveis na função:
  MERCADO_PAGO_ACCESS_TOKEN — consultar pagamento na API MP
  MERCADO_PAGO_SQS_QUEUE_URL — URL da fila SQS mp-webhook-inbound
"""

import boto3
import json
import os
import urllib.error
import urllib.request

MERCADO_PAGO_ACCESS_TOKEN = os.environ.get("MERCADO_PAGO_ACCESS_TOKEN")
SQS_QUEUE_URL = os.environ.get("MERCADO_PAGO_SQS_QUEUE_URL", "").strip()
SQS_CLIENT = boto3.client("sqs")


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

        if not external_reference:
            return response(200, {
                "message": "Evento sem external_reference, ignorado",
                "payment_id": str(payment_id),
                "status_mercado_pago": str(status),
            })

        queue_payload = {
            "consulta_id": str(external_reference),
            "payment_id": str(payment_id),
            "status": str(status or ""),
            "status_detail": str(status_detail or ""),
            "transaction_amount": transaction_amount,
            "payment_type_id": str(payment_type_id or ""),
            "source": "mercadopago-webhook",
        }
        _enqueue_payment(queue_payload)

        body_ok = {
            "message": "Webhook Mercado Pago enfileirado com sucesso",
            "payment_id": payment_id,
            "status_mercado_pago": status,
            "external_reference": external_reference,
            "queue_url": SQS_QUEUE_URL,
        }

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

        # No teste do painel do Mercado Pago, costuma vir `data.id=123456` e a API retorna 404.
        # Respondemos com payload sintético para o handler devolver 200 e o MP não ficar em retry.
        if e.code == 404:
            print(
                "Mercado Pago 404 (pagamento inexistente ou ID de simulação do painel). "
                f"payment_id={payment_id} body={error_body[:500]}"
            )
            return {
                "id": payment_id,
                "status": "not_found",
                "status_detail": "payment_not_found",
                "external_reference": None,
                "transaction_amount": None,
                "payment_type_id": None,
            }

        print("Erro HTTP Mercado Pago:", e.code, error_body)
        raise Exception(f"Erro ao consultar pagamento no Mercado Pago: {error_body}")


def _enqueue_payment(payload):
    if not SQS_QUEUE_URL:
        raise RuntimeError("MERCADO_PAGO_SQS_QUEUE_URL nao configurada")

    SQS_CLIENT.send_message(
        QueueUrl=SQS_QUEUE_URL,
        MessageBody=json.dumps(payload, ensure_ascii=False),
    )


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(body)
    }
