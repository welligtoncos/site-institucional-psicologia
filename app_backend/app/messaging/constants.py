"""Constantes dos fluxos de eventos assíncronos."""

PRODUCTS_EXCHANGE = "products.events"
PRODUCTS_EXCHANGE_TYPE = "topic"

AUDIT_QUEUE = "audit.log.queue"
AUDIT_ROUTING_PATTERN = "product.*"

DLX_EXCHANGE = "products.events.dlx"
DLX_ROUTING_KEY = "product.audit.failed"
DLQ_QUEUE = "audit.log.dlq"

BUSINESS_EXCHANGE = "business.events"
BUSINESS_EXCHANGE_TYPE = "topic"
BUSINESS_AUDIT_QUEUE = "audit.business.queue"
BUSINESS_AUDIT_ROUTING_KEYS = (
    "user.account.created.*",
    "availability.*",
    "appointment.*",
)
BUSINESS_DLX_EXCHANGE = "business.events.dlx"
BUSINESS_DLX_ROUTING_KEY = "business.audit.failed"
BUSINESS_DLQ_QUEUE = "audit.business.dlq"
