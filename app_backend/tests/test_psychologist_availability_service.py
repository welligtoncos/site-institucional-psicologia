"""Serviço de disponibilidade semanal e bloqueios — psicólogo autenticado."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.user import UserRole
from app.schemas.availability_schema import PsychologistAvailabilityPutRequest
from app.services.psychologist_availability_service import PsychologistAvailabilityService


def _psychologist_user() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        name="Psi",
        email="psi@example.com",
        phone="11999999999",
        role=UserRole.psychologist,
        is_active=True,
        terms_accepted_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )


def _disp_row(slot_id, weekday: int, ativo: bool, hi: time, hf: time) -> SimpleNamespace:
    return SimpleNamespace(id=slot_id, dia_semana=weekday, ativo=ativo, hora_inicio=hi, hora_fim=hf)


def _block_row(block_id, d: date, dia_inteiro: bool, hi: time | None, hf: time | None, motivo: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=block_id,
        data_bloqueio=d,
        dia_inteiro=dia_inteiro,
        hora_inicio=hi,
        hora_fim=hf,
        motivo=motivo,
    )


@pytest.mark.asyncio
async def test_get_availability_returns_mapped_weekly_and_blocks() -> None:
    user = _psychologist_user()
    ps_id = uuid4()

    w1_id, w2_id = uuid4(), uuid4()
    b1_id = uuid4()

    weekly_rows = [
        _disp_row(w1_id, 1, True, time(9, 0), time(12, 0)),
        _disp_row(w2_id, 1, False, time(14, 0), time(18, 0)),
    ]
    block_rows = [_block_row(b1_id, date(2026, 7, 20), True, None, None, "Folga")]

    mock_clinical = AsyncMock()
    mock_clinical.get_psicologo_by_usuario_id = AsyncMock(return_value=SimpleNamespace(id=ps_id))
    mock_clinical.list_disponibilidade_semanal = AsyncMock(return_value=weekly_rows)
    mock_clinical.list_bloqueios_agenda = AsyncMock(return_value=block_rows)

    svc = PsychologistAvailabilityService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]

    out = await svc.get_availability(user)  # type: ignore[arg-type]

    assert len(out.weekly) == 2
    assert out.weekly[0].weekday == 1
    assert out.weekly[0].start == "09:00"
    assert out.weekly[0].enabled is True
    assert out.weekly[1].enabled is False

    assert len(out.blocks) == 1
    assert out.blocks[0].iso_date == "2026-07-20"
    assert out.blocks[0].all_day is True
    assert out.blocks[0].note == "Folga"

    mock_clinical.get_psicologo_by_usuario_id.assert_awaited_once_with(user.id)
    mock_clinical.list_disponibilidade_semanal.assert_awaited_once_with(ps_id)
    mock_clinical.list_bloqueios_agenda.assert_awaited_once_with(ps_id)


@pytest.mark.asyncio
async def test_put_availability_replaces_and_returns_lists() -> None:
    user = _psychologist_user()
    ps_id = uuid4()

    after_weekly = [_disp_row(uuid4(), 4, True, time(10, 0), time(11, 0))]
    after_blocks = [_block_row(uuid4(), date(2026, 8, 1), False, time(12, 0), time(13, 30), "Almoço")]

    mock_clinical = AsyncMock()
    mock_clinical.get_psicologo_by_usuario_id = AsyncMock(return_value=SimpleNamespace(id=ps_id))
    mock_clinical.replace_disponibilidade_semanal = AsyncMock()
    mock_clinical.replace_bloqueios_agenda = AsyncMock()
    mock_clinical.list_disponibilidade_semanal = AsyncMock(side_effect=[after_weekly])
    mock_clinical.list_bloqueios_agenda = AsyncMock(side_effect=[after_blocks])

    svc = PsychologistAvailabilityService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]

    payload = PsychologistAvailabilityPutRequest.model_validate(
        {
            "weekly": [{"weekday": 4, "enabled": True, "start": "10:00", "end": "11:00"}],
            "blocks": [
                {
                    "iso_date": "2026-08-01",
                    "all_day": False,
                    "start_time": "12:00",
                    "end_time": "13:30",
                    "note": "Almoço",
                },
            ],
        },
    )

    out = await svc.put_availability(user, payload)  # type: ignore[arg-type]

    mock_clinical.replace_disponibilidade_semanal.assert_awaited_once()
    disp_call = mock_clinical.replace_disponibilidade_semanal.await_args
    assert disp_call.kwargs["slots"] == [(4, True, time(10, 0), time(11, 0))]

    mock_clinical.replace_bloqueios_agenda.assert_awaited_once()
    blo_call = mock_clinical.replace_bloqueios_agenda.await_args
    assert blo_call.kwargs["rows"] == [(date(2026, 8, 1), False, time(12, 0), time(13, 30), "Almoço")]

    assert len(out.weekly) == 1
    assert out.weekly[0].start == "10:00"
    assert len(out.blocks) == 1
    assert out.blocks[0].all_day is False
    assert out.blocks[0].start_time == "12:00"


@pytest.mark.asyncio
async def test_availability_forbids_non_psychologist() -> None:
    user = _psychologist_user()
    user.role = UserRole.patient

    mock_clinical = AsyncMock()
    svc = PsychologistAvailabilityService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]

    with pytest.raises(ForbiddenError):
        await svc.get_availability(user)  # type: ignore[arg-type]

    mock_clinical.get_psicologo_by_usuario_id.assert_not_called()


@pytest.mark.asyncio
async def test_availability_not_found_when_no_psicologo_row() -> None:
    user = _psychologist_user()

    mock_clinical = AsyncMock()
    mock_clinical.get_psicologo_by_usuario_id = AsyncMock(return_value=None)

    svc = PsychologistAvailabilityService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]

    with pytest.raises(NotFoundError):
        await svc.get_availability(user)  # type: ignore[arg-type]
