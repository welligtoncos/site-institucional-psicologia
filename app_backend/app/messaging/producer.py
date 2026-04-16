"""
Producer RabbitMQ para eventos de produto.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import pika
from pika.exceptions import AMQPError

from app.core.config import get_settings
from app.messaging.constants import (
    DLQ_QUEUE,
    DLX_EXCHANGE,
    DLX_ROUTING_KEY,
    PRODUCTS_EXCHANGE,
    PRODUCTS_EXCHANGE_TYPE,
)

logger = logging.getLogger(__name__)


class ProductEventPublisher:
    def __init__(self) -> None:
        self._settings = get_settings()

    def publish(
        self,
        *,
        event_type: str,
        data: dict[str, Any],
        actor: str = "system",
        correlation_id: str | None = None,
    ) -> None:
        payload = {
            "event_id": str(uuid4()),
            "event_type": event_type,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "source": "app_backend",
            "actor": actor,
            "correlation_id": correlation_id or str(uuid4()),
            "data": data,
        }

        params = pika.URLParameters(self._settings.rabbitmq_url)
        try:
            with pika.BlockingConnection(params) as connection:
                channel = connection.channel()
                self._declare_topology(channel)
                channel.basic_publish(
                    exchange=PRODUCTS_EXCHANGE,
                    routing_key=event_type,
                    body=json.dumps(payload, ensure_ascii=False, default=str),
                    properties=pika.BasicProperties(
                        content_type="application/json",
                        delivery_mode=2,
                    ),
                )
                logger.info("Evento publicado no RabbitMQ: %s", event_type)
        except AMQPError:
            logger.exception("Falha ao publicar evento de produto: %s", event_type)
            raise

    @staticmethod
    def _declare_topology(channel: pika.adapters.blocking_connection.BlockingChannel) -> None:
        channel.exchange_declare(
            exchange=PRODUCTS_EXCHANGE,
            exchange_type=PRODUCTS_EXCHANGE_TYPE,
            durable=True,
        )
        channel.exchange_declare(
            exchange=DLX_EXCHANGE,
            exchange_type="direct",
            durable=True,
        )
        channel.queue_declare(queue=DLQ_QUEUE, durable=True)
        channel.queue_bind(queue=DLQ_QUEUE, exchange=DLX_EXCHANGE, routing_key=DLX_ROUTING_KEY)
