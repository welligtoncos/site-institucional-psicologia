"""Constantes do fluxo de eventos de produto."""

PRODUCTS_EXCHANGE = "products.events"
PRODUCTS_EXCHANGE_TYPE = "topic"

AUDIT_QUEUE = "audit.log.queue"
AUDIT_ROUTING_PATTERN = "product.*"

DLX_EXCHANGE = "products.events.dlx"
DLX_ROUTING_KEY = "product.audit.failed"
DLQ_QUEUE = "audit.log.dlq"
