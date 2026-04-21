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
    status: Literal["confirmada", "pendente", "cancelada", "realizada", "em_andamento"]
    payment_pending: bool = False
    patient_online: bool = False
    duration_min: int = 50
    video_call_link: str | None = None
    session_phase: Literal["patient_waiting", "live", "ended"] | None = None
    session_started_at: str | None = None


class PsychologistAgendaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    from_date: date
    appointments: list[PsychologistAgendaAppointmentResponse]
    blocks: list[AgendaBlockResponse]


class PsychologistAppointmentNotesPatchRequest(BaseModel):
    notes: str = Field(default="", max_length=8000)


class PsychologistAppointmentMeetingLinkPatchRequest(BaseModel):
    join_url: str = Field(min_length=8, max_length=2000)


class PsychologistAppointmentOnlineResponse(BaseModel):
    appointment: PsychologistAgendaAppointmentResponse
    join_url: str | None = None
    notes: str = ""
