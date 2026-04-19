"""Disponibilidade semanal e bloqueios do psicólogo (GET/PUT /profiles/psychologist/me/availability)."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class WeeklySlotItem(BaseModel):
    """Intervalo recorrente na semana (vários por dia permitidos)."""

    weekday: int = Field(ge=0, le=6, description="0=domingo … 6=sábado")
    enabled: bool = True
    start: str = Field(min_length=5, max_length=5, description="HH:MM")
    end: str = Field(min_length=5, max_length=5, description="HH:MM")

    @field_validator("start", "end")
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

    @model_validator(mode="after")
    def _fim_depois_inicio(self) -> "WeeklySlotItem":
        a = datetime.strptime(self.start, "%H:%M").time()
        b = datetime.strptime(self.end, "%H:%M").time()
        if b <= a:
            raise ValueError("O horário final deve ser maior que o inicial.")
        return self


class AgendaBlockItem(BaseModel):
    """Bloqueio pontual (substitui todos os bloqueios do psicólogo no PUT)."""

    iso_date: date = Field(description="Data do bloqueio (YYYY-MM-DD)")
    all_day: bool = True
    start_time: str | None = Field(default=None, min_length=5, max_length=5)
    end_time: str | None = Field(default=None, min_length=5, max_length=5)
    note: str = Field(default="", max_length=2000)

    @field_validator("start_time", "end_time")
    @classmethod
    def _optional_hhmm(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
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

    @model_validator(mode="after")
    def _window_if_not_allday(self) -> "AgendaBlockItem":
        if self.all_day:
            return self
        if self.start_time is None or self.end_time is None:
            raise ValueError("Para bloqueio parcial, informe start_time e end_time.")
        a = datetime.strptime(self.start_time, "%H:%M").time()
        b = datetime.strptime(self.end_time, "%H:%M").time()
        if b <= a:
            raise ValueError("O horário final do bloqueio deve ser maior que o inicial.")
        return self


class PsychologistAvailabilityPutRequest(BaseModel):
    weekly: list[WeeklySlotItem]
    blocks: list[AgendaBlockItem]


class WeeklySlotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: UUID
    weekday: int
    enabled: bool
    start: str
    end: str


class AgendaBlockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: UUID
    iso_date: str
    all_day: bool
    start_time: str | None = None
    end_time: str | None = None
    note: str


class PsychologistAvailabilityResponse(BaseModel):
    weekly: list[WeeklySlotResponse]
    blocks: list[AgendaBlockResponse]
