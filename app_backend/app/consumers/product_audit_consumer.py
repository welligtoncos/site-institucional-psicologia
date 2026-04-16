"""
Consumer de auditoria para eventos de produto.

Fluxo:
- consome `product.*` da fila `audit.log.queue`
- grava documento no MongoDB (coleção de auditoria)
- em falha: retry básico por header `x-retries`
- excedendo retries: envia para DLQ
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import pika
from pika.adapters.blocking_connection import BlockingChannel
from pika.exceptions import AMQPError
from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
from pymongo.results import InsertOneResult

from app.core.config import get_settings
from app.messaging.constants import (
    AUDIT_QUEUE,
    AUDIT_ROUTING_PATTERN,
    DLQ_QUEUE,
    DLX_EXCHANGE,
    DLX_ROUTING_KEY,
    PRODUCTS_EXCHANGE,
    PRODUCTS_EXCHANGE_TYPE,
)
from app.schemas.audit_schema import ProductAuditEvent

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")

MAX_RETRIES = 3
CONNECTION_RETRY_SECONDS = 5
_AUDIT_COLLECTION: Any | None = None


def _declare_topology(channel: BlockingChannel) -> None:
    channel.exchange_declare(exchange=PRODUCTS_EXCHANGE, exchange_type=PRODUCTS_EXCHANGE_TYPE, durable=True)
    channel.exchange_declare(exchange=DLX_EXCHANGE, exchange_type="direct", durable=True)

    channel.queue_declare(
        queue=AUDIT_QUEUE,
        durable=True,
        arguments={
            "x-dead-letter-exchange": DLX_EXCHANGE,
            "x-dead-letter-routing-key": DLX_ROUTING_KEY,
        },
    )
    channel.queue_bind(queue=AUDIT_QUEUE, exchange=PRODUCTS_EXCHANGE, routing_key=AUDIT_ROUTING_PATTERN)

    channel.queue_declare(queue=DLQ_QUEUE, durable=True)
    channel.queue_bind(queue=DLQ_QUEUE, exchange=DLX_EXCHANGE, routing_key=DLX_ROUTING_KEY)


def _get_audit_collection() -> Any:
    global _AUDIT_COLLECTION
    if _AUDIT_COLLECTION is not None:
        return _AUDIT_COLLECTION

    settings = get_settings()
    client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
    collection = client[settings.mongo_audit_db][settings.mongo_audit_collection]
    collection.create_index([("event_id", ASCENDING)], unique=True)
    collection.create_index([("user_id", ASCENDING)])
    collection.create_index([("action", ASCENDING)])
    collection.create_index([("occurred_at", ASCENDING)])
    _AUDIT_COLLECTION = collection
    return _AUDIT_COLLECTION


def _persist_audit(collection: Any, payload: dict[str, Any]) -> InsertOneResult:
    event = ProductAuditEvent.model_validate(payload)
    raw_event = event.model_dump(mode="json")
    action = event.event_type.split(".")[-1] if "." in event.event_type else event.event_type
    product_id = str(event.data.get("id", ""))
    product_name = str(event.data.get("nome", ""))

    # Documento amigável para leitura no Mongo Express.
    document = {
        "event_id": event.event_id,
        "event_type": event.event_type,
        "action": action,
        "resource": "product",
        "description": (
            f"Usuário {event.actor} executou '{action}' no produto "
            f"'{product_name or product_id}'."
        ),
        "user_id": event.actor,
        "product_id": product_id or None,
        "product_name": product_name or None,
        "occurred_at": event.occurred_at,
        "correlation_id": event.correlation_id,
        "source": event.source,
        "payload": event.data,
        "raw_event": raw_event,
    }
    return collection.insert_one(document)


def _on_message(channel: BlockingChannel, method: Any, properties: pika.BasicProperties, body: bytes) -> None:
    headers = properties.headers or {}
    retries = int(headers.get("x-retries", 0))

    try:
        payload = json.loads(body.decode("utf-8"))
        collection = _get_audit_collection()
        _persist_audit(collection, payload)
        channel.basic_ack(delivery_tag=method.delivery_tag)
        logger.info("Evento auditado com sucesso: %s", payload.get("event_type"))
    except DuplicateKeyError:
        # Idempotência básica: evento já persistido anteriormente.
        channel.basic_ack(delivery_tag=method.delivery_tag)
        logger.info("Evento já processado (duplicado): %s", method.routing_key)
    except Exception:
        logger.exception("Erro ao processar evento (retry=%s)", retries)
        if retries < MAX_RETRIES:
            updated_headers = {**headers, "x-retries": retries + 1}
            channel.basic_publish(
                exchange=PRODUCTS_EXCHANGE,
                routing_key=method.routing_key,
                body=body,
                properties=pika.BasicProperties(
                    content_type=properties.content_type or "application/json",
                    delivery_mode=2,
                    headers=updated_headers,
                ),
            )
            channel.basic_ack(delivery_tag=method.delivery_tag)
            return

        channel.basic_publish(
            exchange=DLX_EXCHANGE,
            routing_key=DLX_ROUTING_KEY,
            body=body,
            properties=pika.BasicProperties(
                content_type=properties.content_type or "application/json",
                delivery_mode=2,
                headers=headers,
            ),
        )
        channel.basic_ack(delivery_tag=method.delivery_tag)


def main() -> None:
    settings = get_settings()
    params = pika.URLParameters(settings.rabbitmq_url)
    while True:
        try:
            collection = _get_audit_collection()
            collection.database.client.admin.command("ping")
            with pika.BlockingConnection(params) as connection:
                channel = connection.channel()
                _declare_topology(channel)
                channel.basic_qos(prefetch_count=10)
                channel.basic_consume(queue=AUDIT_QUEUE, on_message_callback=_on_message)
                logger.info("Audit consumer aguardando mensagens na fila '%s'...", AUDIT_QUEUE)
                channel.start_consuming()
        except (AMQPError, PyMongoError):
            logger.exception(
                "Dependência de mensageria/auditoria indisponível. Tentando reconectar em %ss...",
                CONNECTION_RETRY_SECONDS,
            )
            time.sleep(CONNECTION_RETRY_SECONDS)


if __name__ == "__main__":
    main()
