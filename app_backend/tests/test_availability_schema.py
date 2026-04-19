"""Validação Pydantic da disponibilidade do psicólogo."""

from __future__ import annotations

from datetime import date

import pytest
from pydantic import ValidationError

from app.schemas.availability_schema import (
    AgendaBlockItem,
    PsychologistAvailabilityPutRequest,
    WeeklySlotItem,
)


def test_weekly_slot_item_accepts_valid_window() -> None:
    row = WeeklySlotItem(weekday=2, enabled=True, start="09:00", end="18:00")
    assert row.weekday == 2
    assert row.start == "09:00"
    assert row.end == "18:00"


def test_weekly_slot_item_outputs_canonical_hhmm() -> None:
    """Validador devolve HH:MM com zeros à esquerda nos componentes."""
    row = WeeklySlotItem(weekday=1, start="09:05", end="18:30")
    assert row.start == "09:05"
    assert row.end == "18:30"


def test_weekly_slot_item_rejects_end_before_or_equal_start() -> None:
    with pytest.raises(ValidationError, match="final deve ser maior"):
        WeeklySlotItem(weekday=1, start="10:00", end="10:00")

    with pytest.raises(ValidationError, match="final deve ser maior"):
        WeeklySlotItem(weekday=1, start="11:00", end="09:00")


def test_weekly_slot_item_rejects_invalid_weekday() -> None:
    with pytest.raises(ValidationError):
        WeeklySlotItem(weekday=7, start="09:00", end="18:00")


def test_agenda_block_item_all_day_without_times() -> None:
    b = AgendaBlockItem(iso_date=date(2026, 5, 1), all_day=True, note="Feriado")
    assert b.all_day is True
    assert b.start_time is None


def test_agenda_block_item_partial_requires_window_and_order() -> None:
    with pytest.raises(ValidationError, match="start_time e end_time"):
        AgendaBlockItem(iso_date=date(2026, 5, 1), all_day=False)

    with pytest.raises(ValidationError, match="bloqueio deve ser maior"):
        AgendaBlockItem(
            iso_date=date(2026, 5, 1),
            all_day=False,
            start_time="14:00",
            end_time="13:00",
        )


def test_psychologist_availability_put_request_roundtrip() -> None:
    payload = PsychologistAvailabilityPutRequest.model_validate(
        {
            "weekly": [{"weekday": 3, "enabled": False, "start": "08:00", "end": "12:00"}],
            "blocks": [{"iso_date": "2026-06-10", "all_day": True, "note": "Curso"}],
        },
    )
    assert len(payload.weekly) == 1
    assert payload.blocks[0].iso_date == date(2026, 6, 10)
