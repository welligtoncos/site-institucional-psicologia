"""Cálculo de slots livres para agendamento (sem banco)."""

from __future__ import annotations

from datetime import date, time
from types import SimpleNamespace

from app.core.booking_availability import slots_for_calendar_day, weekday_js, weekday_label_pt


def test_weekday_label_pt() -> None:
    assert "Segunda" in weekday_label_pt(1)
    assert "Domingo" in weekday_label_pt(0)


def test_weekday_js_matches_js_get_day_convention() -> None:
    # 2026-04-19 is Sunday
    assert weekday_js(date(2026, 4, 19)) == 0
    # Monday
    assert weekday_js(date(2026, 4, 20)) == 1


def test_slots_respect_weekly_window_and_duration() -> None:
    weekly = [SimpleNamespace(dia_semana=1, ativo=True, hora_inicio=time(9, 0), hora_fim=time(10, 30))]
    today = date(2026, 4, 20)  # Monday
    slots = slots_for_calendar_day(
        today,
        today_br=today,
        now_minutes_br=0,
        weekly=weekly,
        blocks=[],
        consultas=[],
        duracao_minutos=50,
    )
    assert slots == ["09:00"]
    slots2 = slots_for_calendar_day(
        today,
        today_br=today,
        now_minutes_br=0,
        weekly=weekly,
        blocks=[],
        consultas=[],
        duracao_minutos=30,
    )
    assert slots2 == ["09:00"]


def test_full_day_block_empties_slots() -> None:
    weekly = [SimpleNamespace(dia_semana=2, ativo=True, hora_inicio=time(8, 0), hora_fim=time(18, 0))]
    day = date(2026, 4, 21)  # Tuesday
    blocks = [SimpleNamespace(data_bloqueio=day, dia_inteiro=True, hora_inicio=None, hora_fim=None)]
    slots = slots_for_calendar_day(
        day,
        today_br=date(2026, 4, 19),
        now_minutes_br=0,
        weekly=weekly,
        blocks=blocks,
        consultas=[],
        duracao_minutos=50,
    )
    assert slots == []


def test_consulta_removes_overlapping_start() -> None:
    weekly = [SimpleNamespace(dia_semana=3, ativo=True, hora_inicio=time(9, 0), hora_fim=time(12, 0))]
    day = date(2026, 4, 22)  # Wednesday
    consultas = [SimpleNamespace(data_agendada=day, hora_inicio=time(10, 0), duracao_minutos=50)]
    slots = slots_for_calendar_day(
        day,
        today_br=date(2026, 4, 19),
        now_minutes_br=0,
        weekly=weekly,
        blocks=[],
        consultas=consultas,
        duracao_minutos=50,
    )
    assert slots == ["09:00"]


def test_past_times_hidden_on_same_day() -> None:
    # Um início por intervalo cadastrado: intervalo 8–9 já passou; 10–11 ainda é elegível às 10:00.
    weekly = [
        SimpleNamespace(dia_semana=4, ativo=True, hora_inicio=time(8, 0), hora_fim=time(9, 0)),
        SimpleNamespace(dia_semana=4, ativo=True, hora_inicio=time(10, 0), hora_fim=time(11, 0)),
    ]
    day = date(2026, 4, 23)
    slots = slots_for_calendar_day(
        day,
        today_br=day,
        now_minutes_br=10 * 60,
        weekly=weekly,
        blocks=[],
        consultas=[],
        duracao_minutos=60,
    )
    assert "08:00" not in slots
    assert slots == ["10:00"]
