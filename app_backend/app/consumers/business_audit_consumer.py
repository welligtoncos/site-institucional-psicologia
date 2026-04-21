"""
Consumer de auditoria para eventos de negócio.

Fluxo:
- consome eventos de conta, disponibilidade e consulta na fila `audit.business.queue`
- grava documento no MongoDB (coleção de auditoria de negócio)
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
from pika.exceptions import AMQPConnectionError, AMQPError
from pymongo import ASCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
from pymongo.results import InsertOneResult

from app.core.config import get_settings
from app.messaging.constants import (
    BUSINESS_AUDIT_QUEUE,
    BUSINESS_AUDIT_ROUTING_KEYS,
    BUSINESS_DLX_EXCHANGE,
    BUSINESS_DLX_ROUTING_KEY,
    BUSINESS_DLQ_QUEUE,
    BUSINESS_EXCHANGE,
    BUSINESS_EXCHANGE_TYPE,
)
from app.schemas.business_audit_schema import BusinessAuditEvent

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")

MAX_RETRIES = 3
CONNECTION_RETRY_SECONDS = 5
_AUDIT_COLLECTION: Any | None = None


def _declare_topology(channel: BlockingChannel) -> None:
    channel.exchange_declare(exchange=BUSINESS_EXCHANGE, exchange_type=BUSINESS_EXCHANGE_TYPE, durable=True)
    channel.exchange_declare(exchange=BUSINESS_DLX_EXCHANGE, exchange_type="direct", durable=True)

    channel.queue_declare(
        queue=BUSINESS_AUDIT_QUEUE,
        durable=True,
        arguments={
            "x-dead-letter-exchange": BUSINESS_DLX_EXCHANGE,
            "x-dead-letter-routing-key": BUSINESS_DLX_ROUTING_KEY,
        },
    )
    for routing_key in BUSINESS_AUDIT_ROUTING_KEYS:
        channel.queue_bind(queue=BUSINESS_AUDIT_QUEUE, exchange=BUSINESS_EXCHANGE, routing_key=routing_key)

    channel.queue_declare(queue=BUSINESS_DLQ_QUEUE, durable=True)
    channel.queue_bind(queue=BUSINESS_DLQ_QUEUE, exchange=BUSINESS_DLX_EXCHANGE, routing_key=BUSINESS_DLX_ROUTING_KEY)


def _get_audit_collection() -> Any:
    global _AUDIT_COLLECTION
    if _AUDIT_COLLECTION is not None:
        return _AUDIT_COLLECTION

    settings = get_settings()
    client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
    collection = client[settings.mongo_audit_db][settings.mongo_business_audit_collection]
    collection.create_index([("event_id", ASCENDING)], unique=True)
    collection.create_index([("event_type", ASCENDING)])
    collection.create_index([("actor", ASCENDING)])
    collection.create_index([("resource_type", ASCENDING), ("resource_id", ASCENDING)])
    collection.create_index([("occurred_at", ASCENDING)])
    _AUDIT_COLLECTION = collection
    return _AUDIT_COLLECTION


def _persist_audit(collection: Any, payload: dict[str, Any]) -> InsertOneResult:
    event = BusinessAuditEvent.model_validate(payload)
    raw_event = event.model_dump(mode="json")
    action = event.event_type.split(".")[-1] if "." in event.event_type else event.event_type
    resource = event.resource_type
    resource_id = event.resource_id

    document = {
        "event_id": event.event_id,
        "event_type": event.event_type,
        "action": action,
        "resource": resource,
        "resource_id": resource_id,
        "description": (
            f"Usuário {event.actor} executou '{event.event_type}' "
            f"no recurso '{resource}' ({resource_id or 'sem-id'})."
        ),
        "actor": event.actor,
        "occurred_at": event.occurred_at,
        "correlation_id": event.correlation_id,
        "source": event.source,
        "payload": event.data,
        "metadata": event.metadata,
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
        logger.info("Evento de negócio auditado: %s", payload.get("event_type"))
    except DuplicateKeyError:
        channel.basic_ack(delivery_tag=method.delivery_tag)
        logger.info("Evento de negócio duplicado ignorado: %s", method.routing_key)
    except Exception:
        logger.exception("Erro ao processar evento de negócio (retry=%s)", retries)
        if retries < MAX_RETRIES:
            updated_headers = {**headers, "x-retries": retries + 1}
            channel.basic_publish(
                exchange=BUSINESS_EXCHANGE,
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
            exchange=BUSINESS_DLX_EXCHANGE,
            routing_key=BUSINESS_DLX_ROUTING_KEY,
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
                channel.basic_consume(queue=BUSINESS_AUDIT_QUEUE, on_message_callback=_on_message)
                logger.info("Business audit consumer aguardando mensagens na fila '%s'...", BUSINESS_AUDIT_QUEUE)
                channel.start_consuming()
        except AMQPConnectionError:
            # Esperado em startup quando RabbitMQ ainda não aceitou conexões.
            logger.warning(
                "RabbitMQ ainda indisponível. Nova tentativa em %ss...",
                CONNECTION_RETRY_SECONDS,
            )
            time.sleep(CONNECTION_RETRY_SECONDS)
        except PyMongoError as exc:
            # Esperado em startup quando MongoDB ainda não aceitou conexões.
            logger.warning(
                "MongoDB ainda indisponível (%s). Nova tentativa em %ss...",
                exc.__class__.__name__,
                CONNECTION_RETRY_SECONDS,
            )
            time.sleep(CONNECTION_RETRY_SECONDS)
        except AMQPError:
            logger.exception(
                "Falha AMQP inesperada no consumer. Tentando reconectar em %ss...",
                CONNECTION_RETRY_SECONDS,
            )
            time.sleep(CONNECTION_RETRY_SECONDS)


if __name__ == "__main__":
    main()
