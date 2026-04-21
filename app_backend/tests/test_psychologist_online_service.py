"""Fluxos online do psicólogo: entrar em sala, anotar e finalizar."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.core.exceptions import ConflictError
from app.models.clinical import ConsultaSituacaoPagamento, ConsultaStatus
from app.models.user import UserRole
from app.schemas.agenda_schema import PsychologistAppointmentNotesPatchRequest
from app.schemas.agenda_schema import PsychologistAppointmentMeetingLinkPatchRequest
from app.services.psychologist_agenda_service import PsychologistAgendaService


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


def _consulta(status: ConsultaStatus = ConsultaStatus.confirmada):
    return SimpleNamespace(
        id=uuid4(),
        paciente_id=uuid4(),
        psicologo_id=uuid4(),
        data_agendada=date.today(),
        hora_inicio=datetime.now().time().replace(second=0, microsecond=0),
        duracao_minutos=50,
        modalidade=SimpleNamespace(value="Online"),
        status=status,
        situacao_pagamento=ConsultaSituacaoPagamento.pago,
        link_videochamada_opcional=None,
        observacoes="",
        paciente=SimpleNamespace(usuario=SimpleNamespace(name="Paciente Teste")),
    )


@pytest.mark.asyncio
async def test_psychologist_join_room_marks_in_progress() -> None:
    user = _psychologist_user()
    consulta = _consulta(status=ConsultaStatus.confirmada)

    mock_clinical = AsyncMock()
    mock_clinical.get_consulta_com_cobranca_do_psicologo = AsyncMock(return_value=consulta)
    mock_clinical.save_consulta = AsyncMock(return_value=consulta)

    svc = PsychologistAgendaService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]
    svc._audit = SimpleNamespace(publish=lambda **_: None)  # type: ignore[attr-defined]

    out = await svc.join_room(user, consulta.id)  # type: ignore[arg-type]

    assert out.join_url is not None
    assert consulta.status == ConsultaStatus.em_andamento
    mock_clinical.save_consulta.assert_awaited_once()


@pytest.mark.asyncio
async def test_psychologist_notes_update() -> None:
    user = _psychologist_user()
    consulta = _consulta(status=ConsultaStatus.em_andamento)

    mock_clinical = AsyncMock()
    mock_clinical.get_consulta_com_cobranca_do_psicologo = AsyncMock(return_value=consulta)
    mock_clinical.save_consulta = AsyncMock(return_value=consulta)

    svc = PsychologistAgendaService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]
    svc._audit = SimpleNamespace(publish=lambda **_: None)  # type: ignore[attr-defined]

    payload = PsychologistAppointmentNotesPatchRequest(notes="Paciente evoluiu bem.")
    out = await svc.patch_notes(user, consulta.id, payload)  # type: ignore[arg-type]

    assert out.notes == "Paciente evoluiu bem."
    assert consulta.observacoes == "Paciente evoluiu bem."
    mock_clinical.save_consulta.assert_awaited_once()


@pytest.mark.asyncio
async def test_psychologist_finish_marks_realizada() -> None:
    user = _psychologist_user()
    consulta = _consulta(status=ConsultaStatus.em_andamento)

    mock_clinical = AsyncMock()
    mock_clinical.get_consulta_com_cobranca_do_psicologo = AsyncMock(return_value=consulta)
    mock_clinical.save_consulta = AsyncMock(return_value=consulta)

    svc = PsychologistAgendaService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]
    svc._audit = SimpleNamespace(publish=lambda **_: None)  # type: ignore[attr-defined]

    out = await svc.finish_appointment(user, consulta.id)  # type: ignore[arg-type]

    assert out.appointment.status == "realizada"
    assert consulta.status == ConsultaStatus.realizada
    mock_clinical.save_consulta.assert_awaited_once()


@pytest.mark.asyncio
async def test_psychologist_finish_rejects_closed_appointment() -> None:
    user = _psychologist_user()
    consulta = _consulta(status=ConsultaStatus.realizada)

    mock_clinical = AsyncMock()
    mock_clinical.get_consulta_com_cobranca_do_psicologo = AsyncMock(return_value=consulta)

    svc = PsychologistAgendaService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]
    svc._audit = SimpleNamespace(publish=lambda **_: None)  # type: ignore[attr-defined]

    with pytest.raises(ConflictError):
        await svc.finish_appointment(user, consulta.id)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_psychologist_patch_meeting_link() -> None:
    user = _psychologist_user()
    consulta = _consulta(status=ConsultaStatus.confirmada)

    mock_clinical = AsyncMock()
    mock_clinical.get_consulta_com_cobranca_do_psicologo = AsyncMock(return_value=consulta)
    mock_clinical.save_consulta = AsyncMock(return_value=consulta)

    svc = PsychologistAgendaService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]
    svc._audit = SimpleNamespace(publish=lambda **_: None)  # type: ignore[attr-defined]

    payload = PsychologistAppointmentMeetingLinkPatchRequest(join_url="https://meet.google.com/abc-defg-hij")
    out = await svc.patch_meeting_link(user, consulta.id, payload)  # type: ignore[arg-type]

    assert out.join_url == "https://meet.google.com/abc-defg-hij"
    assert consulta.link_videochamada_opcional == "https://meet.google.com/abc-defg-hij"
    mock_clinical.save_consulta.assert_awaited_once()
