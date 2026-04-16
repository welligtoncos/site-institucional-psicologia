"""
Schema do documento de auditoria persistido no MongoDB.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ProductAuditEvent(BaseModel):
    event_id: str
    event_type: str
    occurred_at: datetime
    source: str = "app_backend"
    actor: str = Field(description="Usuário autenticado que disparou a ação")
    correlation_id: str
    data: dict[str, Any]
