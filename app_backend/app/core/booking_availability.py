"""Cálculo de horários livres para agendamento (paciente), a partir da semana tipo, bloqueios e consultas."""

from __future__ import annotations

from datetime import date, time, timedelta
from typing import Protocol
from zoneinfo import ZoneInfo

_BR = ZoneInfo("America/Sao_Paulo")

_WEEKDAY_LABEL_PT_BR: tuple[str, ...] = (
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
)


def weekday_label_pt(weekday: int) -> str:
    """Rótulo do dia (0=domingo … 6=sábado), alinhado ao front da disponibilidade."""
    w = int(weekday)
    if 0 <= w <= 6:
        return _WEEKDAY_LABEL_PT_BR[w]
    return "Dia inválido"


def weekday_js(d: date) -> int:
    """0=domingo … 6=sábado (alinhado a `Date.getDay()` no JavaScript e `dia_semana` no banco)."""
    return (d.weekday() + 1) % 7


def _time_to_minutes(t: time) -> int:
    """Minutos desde meia-noite (segundos arredondados para baixo ao minuto)."""
    return (t.hour * 3600 + t.minute * 60 + t.second) // 60


def _minutes_to_time(m: int) -> time:
    return time(m // 60, m % 60, 0, 0)


def _hhmm(t: time) -> str:
    return t.strftime("%H:%M")


def _ranges_overlap(a0: int, a1: int, b0: int, b1: int) -> bool:
    """Intervalos semiabertos [a0,a1) e [b0,b1)."""
    return not (a1 <= b0 or a0 >= b1)


class _WeeklyLike(Protocol):
    dia_semana: int
    ativo: bool
    hora_inicio: time
    hora_fim: time


class _BlockLike(Protocol):
    data_bloqueio: date
    dia_inteiro: bool
    hora_inicio: time | None
    hora_fim: time | None


class _ConsultaLike(Protocol):
    data_agendada: date
    hora_inicio: time
    duracao_minutos: int


def _busy_intervals_from_blocks(day: date, blocks: list[_BlockLike]) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for b in blocks:
        if b.data_bloqueio != day:
            continue
        if b.dia_inteiro:
            return [(0, 24 * 60)]
        if b.hora_inicio is None or b.hora_fim is None:
            continue
        s = _time_to_minutes(b.hora_inicio)
        e = _time_to_minutes(b.hora_fim)
        if e > s:
            out.append((s, e))
    return out


def _busy_intervals_from_consultas(day: date, consultas: list[_ConsultaLike]) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for c in consultas:
        if c.data_agendada != day:
            continue
        s = _time_to_minutes(c.hora_inicio)
        e = s + int(c.duracao_minutos)
        out.append((s, e))
    return out


def _conflicts_busy(start_m: int, end_m: int, busy: list[tuple[int, int]]) -> bool:
    for b0, b1 in busy:
        if _ranges_overlap(start_m, end_m, b0, b1):
            return True
    return False


def slots_for_calendar_day(
    day: date,
    *,
    today_br: date,
    now_minutes_br: int,
    weekly: list[_WeeklyLike],
    blocks: list[_BlockLike],
    consultas: list[_ConsultaLike],
    duracao_minutos: int,
) -> list[str]:
    """Um início HH:MM por linha em `disponibilidade_semanal` (hora_inicio), se a sessão couber em [hora_inicio, hora_fim)."""
    wd = int(weekday_js(day))
    busy_blocks = _busy_intervals_from_blocks(day, blocks)
    if busy_blocks == [(0, 24 * 60)]:
        return []

    busy_consultas = _busy_intervals_from_consultas(day, consultas)
    all_busy = [*busy_blocks, *busy_consultas]

    seen: set[str] = set()
    out: list[str] = []

    for row in weekly:
        if int(row.dia_semana) != wd or not bool(row.ativo):
            continue
        ws = _time_to_minutes(row.hora_inicio)
        we = _time_to_minutes(row.hora_fim)
        if we <= ws or duracao_minutos <= 0:
            continue
        if ws + duracao_minutos > we:
            continue
        t = ws
        if day == today_br and t < now_minutes_br:
            continue
        if _conflicts_busy(t, t + duracao_minutos, all_busy):
            continue
        label = _hhmm(_minutes_to_time(t))
        if label not in seen:
            seen.add(label)
            out.append(label)

    return sorted(out)


def iter_dates(start: date, num_days: int) -> list[date]:
    return [start + timedelta(days=i) for i in range(num_days)]


def today_br() -> date:
    from datetime import datetime

    return datetime.now(_BR).date()


def now_minutes_br() -> int:
    from datetime import datetime

    n = datetime.now(_BR)
    return n.hour * 60 + n.minute
