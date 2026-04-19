"""Catálogo: horários livres para paciente."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.user import UserRole
from app.services.catalog_service import CatalogService


def _patient_user() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        name="Paciente",
        email="p@example.com",
        phone="11999999999",
        role=UserRole.patient,
        is_active=True,
        terms_accepted_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )


@pytest.mark.asyncio
async def test_bookable_slots_forbids_non_patient() -> None:
    user = _patient_user()
    user.role = UserRole.psychologist
    svc = CatalogService(AsyncMock())
    with pytest.raises(ForbiddenError):
        await svc.get_psychologist_bookable_slots(user, uuid4(), days=7)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_bookable_slots_not_found_when_psych_inactive() -> None:
    user = _patient_user()
    mock_clinical = AsyncMock()
    mock_clinical.get_psicologo_ativo_by_id = AsyncMock(return_value=None)

    svc = CatalogService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]

    with pytest.raises(NotFoundError):
        await svc.get_psychologist_bookable_slots(user, uuid4(), days=7)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_bookable_slots_returns_days(monkeypatch: pytest.MonkeyPatch) -> None:
    user = _patient_user()
    ps_id = uuid4()
    usuario = SimpleNamespace(name="Dr. Teste")
    ps = SimpleNamespace(
        id=ps_id,
        usuario=usuario,
        crp="06/1",
        valor_sessao_padrao=Decimal("150.00"),
        duracao_minutos_padrao=50,
        especialidades="TCC",
    )

    weekly = [SimpleNamespace(dia_semana=1, ativo=True, hora_inicio=time(9, 0), hora_fim=time(10, 0))]
    fixed_monday = date(2026, 4, 20)

    mock_clinical = AsyncMock()
    mock_clinical.get_psicologo_ativo_by_id = AsyncMock(return_value=ps)
    mock_clinical.list_disponibilidade_semanal = AsyncMock(return_value=weekly)
    mock_clinical.list_bloqueios_agenda = AsyncMock(return_value=[])
    mock_clinical.list_consultas_psicologo_no_periodo = AsyncMock(return_value=[])

    svc = CatalogService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]

    monkeypatch.setattr("app.services.catalog_service.today_br", lambda: fixed_monday)
    monkeypatch.setattr("app.services.catalog_service.now_minutes_br", lambda: 0)

    out = await svc.get_psychologist_bookable_slots(user, ps_id, days=3)  # type: ignore[arg-type]

    assert out.nome == "Dr. Teste"
    assert out.duracao_minutos == 50
    assert len(out.days) == 3
    monday = next(d for d in out.days if d.date == fixed_monday.isoformat())
    assert monday.weekday == 1
    assert "Segunda" in monday.weekday_label
    assert len(out.weekly_template) == 1
    assert out.weekly_template[0].start == "09:00"
    assert monday.slots == ["09:00"]
