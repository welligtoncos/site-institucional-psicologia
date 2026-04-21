"""Agendamento do paciente e operações de atendimento online."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PatientAppointmentCreateRequest(BaseModel):
    psychologist_id: UUID
    iso_date: date
    time: str = Field(min_length=5, max_length=5, description="HH:MM")
    format: str = Field(default="Online", description="Online ou Presencial")

    @field_validator("time")
    @classmethod
    def _hhmm(cls, v: str) -> str:
        parts = v.split(":")
        if len(parts) != 2:
            raise ValueError("Use horário no formato HH:MM.")
        h, m = parts
        if len(h) != 2 or len(m) != 2 or not h.isdigit() or not m.isdigit():
            raise ValueError("Use horário no formato HH:MM.")
        hi, mi = int(h), int(m)
        if not (0 <= hi <= 23 and 0 <= mi <= 59):
            raise ValueError("Horário inválido.")
        return f"{hi:02d}:{mi:02d}"


class PatientAppointmentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: UUID
    psychologist_id: UUID
    psychologist_name: str
    psychologist_crp: str
    patient_name: str
    specialty: str
    iso_date: str
    time: str
    format: str
    price: Decimal
    duration_min: int
    payment: str
    status: str
    video_call_link: str | None = None
    psychologist_online: bool = False
    session_phase: str | None = None
    session_started_at: str | None = None


class PatientChargeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: UUID
    appointment_id: UUID
    amount_cents: int
    currency: str
    gateway_provider: str
    gateway_intent_id: str
    gateway_status: str
    created_at: str
    paid_at: str | None = None


class PatientAppointmentCreateResponse(BaseModel):
    appointment: PatientAppointmentSummary
    charge: PatientChargeSummary


class PatientAppointmentPaymentResponse(BaseModel):
    appointment: PatientAppointmentSummary
    charge: PatientChargeSummary


class PatientAppointmentListResponse(BaseModel):
    appointments: list[PatientAppointmentSummary]


class AppointmentJoinRoomResponse(BaseModel):
    appointment: PatientAppointmentSummary
    join_url: str
    started_now: bool = False


class AppointmentLeaveRoomResponse(BaseModel):
    appointment: PatientAppointmentSummary
    left_now: bool = True
