"""Agenda do psicólogo autenticado (GET /profiles/psychologist/me/agenda)."""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.availability_schema import AgendaBlockResponse


class PsychologistAgendaAppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: UUID
    patient_id: UUID
    patient_name: str
    iso_date: str = Field(description="AAAA-MM-DD")
    time: str = Field(description="HH:MM")
    format: Literal["Online", "Presencial"]
    status: Literal["confirmada", "pendente", "cancelada", "realizada"]
    payment_pending: bool = False


class PsychologistAgendaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    from_date: date
    appointments: list[PsychologistAgendaAppointmentResponse]
    blocks: list[AgendaBlockResponse]
