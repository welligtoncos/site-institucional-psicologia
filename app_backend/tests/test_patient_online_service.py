"""Fluxos online do paciente: lista de consultas e entrada em sala."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.core.exceptions import ConflictError, ForbiddenError
from app.models.clinical import ConsultaSituacaoPagamento, ConsultaStatus, SessaoAoVivoFase
from app.models.user import UserRole
from app.services.patient_appointment_service import PatientAppointmentService


def _patient_user() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        name="Paciente",
        email="paciente@example.com",
        phone="11999999999",
        role=UserRole.patient,
        is_active=True,
        terms_accepted_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )


def _consulta(*, status: ConsultaStatus = ConsultaStatus.confirmada, d: date | None = None, t: time | None = None):
    when_date = d or date.today()
    when_time = t or datetime.now().time().replace(second=0, microsecond=0)
    return SimpleNamespace(
        id=uuid4(),
        paciente_id=uuid4(),
        psicologo_id=uuid4(),
        data_agendada=when_date,
        hora_inicio=when_time,
        duracao_minutos=50,
        modalidade=SimpleNamespace(value="Online"),
        status=status,
        situacao_pagamento=ConsultaSituacaoPagamento.pago,
        valor_acordado=150,
        especialidade_atendida="Ansiedade",
        link_videochamada_opcional=None,
        observacoes="",
        paciente=SimpleNamespace(usuario=SimpleNamespace(name="Paciente Teste")),
        psicologo=SimpleNamespace(usuario=SimpleNamespace(name="Psicóloga Ana"), crp="CRP-123"),
        cobranca=SimpleNamespace(
            id=uuid4(),
            consulta_id=uuid4(),
            valor_centavos=15000,
            moeda="BRL",
            provedor_gateway="mock",
            id_intent_gateway="pi_mock",
            status_gateway=SimpleNamespace(value="succeeded"),
            criado_em=datetime.now(timezone.utc),
            pago_em=datetime.now(timezone.utc),
        ),
    )


@pytest.mark.asyncio
async def test_list_my_appointments_returns_items() -> None:
    user = _patient_user()
    rows = [_consulta(status=ConsultaStatus.confirmada), _consulta(status=ConsultaStatus.agendada)]

    mock_clinical = AsyncMock()
    mock_clinical.list_consultas_com_cobranca_do_paciente_desde = AsyncMock(return_value=rows)

    svc = PatientAppointmentService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]
    svc._audit = SimpleNamespace(publish=lambda **_: None)  # type: ignore[attr-defined]

    out = await svc.list_my_appointments(user, from_date=date.today())  # type: ignore[arg-type]

    assert len(out.appointments) == 2
    assert out.appointments[0].psychologist_name == "Psicóloga Ana"
    mock_clinical.list_consultas_com_cobranca_do_paciente_desde.assert_awaited_once_with(user.id, date.today())


@pytest.mark.asyncio
async def test_join_room_patient_marks_in_progress() -> None:
    user = _patient_user()
    consulta = _consulta(status=ConsultaStatus.confirmada)

    mock_clinical = AsyncMock()
    mock_clinical.get_consulta_com_cobranca_do_paciente = AsyncMock(return_value=consulta)
    mock_clinical.save_consulta = AsyncMock(return_value=consulta)

    svc = PatientAppointmentService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]
    svc._audit = SimpleNamespace(publish=lambda **_: None)  # type: ignore[attr-defined]

    out = await svc.join_room(user, consulta.id)  # type: ignore[arg-type]

    assert out.join_url.startswith("https://meet.exemplo.com/")
    assert out.started_now is False
    assert consulta.status == ConsultaStatus.confirmada
    mock_clinical.save_consulta.assert_awaited_once()


@pytest.mark.asyncio
async def test_join_room_patient_requires_confirmed_status() -> None:
    user = _patient_user()
    consulta = _consulta(status=ConsultaStatus.agendada)

    mock_clinical = AsyncMock()
    mock_clinical.get_consulta_com_cobranca_do_paciente = AsyncMock(return_value=consulta)

    svc = PatientAppointmentService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]
    svc._audit = SimpleNamespace(publish=lambda **_: None)  # type: ignore[attr-defined]

    with pytest.raises(ConflictError):
        await svc.join_room(user, consulta.id)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_join_room_patient_blocks_outside_window() -> None:
    user = _patient_user()
    consulta = _consulta(status=ConsultaStatus.confirmada, d=date.today() + timedelta(days=365), t=time(9, 0))

    mock_clinical = AsyncMock()
    mock_clinical.get_consulta_com_cobranca_do_paciente = AsyncMock(return_value=consulta)

    svc = PatientAppointmentService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]
    svc._audit = SimpleNamespace(publish=lambda **_: None)  # type: ignore[attr-defined]

    with pytest.raises(ForbiddenError):
        await svc.join_room(user, consulta.id)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_leave_room_patient_marks_left() -> None:
    user = _patient_user()
    consulta = _consulta(status=ConsultaStatus.confirmada)
    consulta.sessao_ao_vivo = SimpleNamespace(
        fase=SessaoAoVivoFase.patient_waiting,
        encerrada_em=None,
    )

    mock_clinical = AsyncMock()
    mock_clinical.get_consulta_com_cobranca_do_paciente = AsyncMock(return_value=consulta)
    mock_clinical.mark_sessao_ended = AsyncMock()
    mock_clinical.save_consulta = AsyncMock(return_value=consulta)

    svc = PatientAppointmentService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]
    svc._audit = SimpleNamespace(publish=lambda **_: None)  # type: ignore[attr-defined]

    out = await svc.leave_room(user, consulta.id)  # type: ignore[arg-type]

    assert out.left_now is True
    mock_clinical.mark_sessao_ended.assert_awaited_once()
    mock_clinical.save_consulta.assert_awaited_once()
