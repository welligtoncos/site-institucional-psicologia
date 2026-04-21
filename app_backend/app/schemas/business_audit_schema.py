"""
Schema do evento de auditoria de negócio.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class BusinessAuditEvent(BaseModel):
    event_id: str
    event_type: str
    occurred_at: datetime
    source: str = "app_backend"
    actor: str = Field(description="Usuário autenticado que disparou a ação")
    correlation_id: str
    resource_type: str
    resource_id: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
