"""Serviço de perfil — atualização do paciente autenticado."""

from __future__ import annotations

from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.core.exceptions import ForbiddenError
from app.models.user import UserRole
from app.schemas.profile_schema import PatientProfilePatchRequest
from app.services.profile_service import ProfileService


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
async def test_patch_patient_me_updates_user_and_paciente() -> None:
    user = _patient_user()
    paciente = SimpleNamespace(
        id=uuid4(),
        usuario_id=user.id,
        contato_emergencia=None,
        cpf="11144477735",
        data_nascimento=date(1991, 3, 15),
        cep="01310100",
        logradouro="Av. Paulista",
        numero="1000",
        complemento=None,
        bairro="Bela Vista",
        cidade="São Paulo",
        uf="SP",
        ponto_referencia=None,
        criado_em=datetime.now(timezone.utc),
    )
    mock_clinical = AsyncMock()
    mock_clinical.upsert_paciente_perfil = AsyncMock(return_value=paciente)
    mock_users = AsyncMock()
    mock_users.update_name_phone = AsyncMock(
        return_value=SimpleNamespace(
            **{**user.__dict__, "name": "Maria Silva", "phone": "11988887777"},
        ),
    )

    svc = ProfileService(AsyncMock())
    svc._clinical = mock_clinical  # type: ignore[attr-defined]
    svc._users = mock_users  # type: ignore[attr-defined]

    payload = PatientProfilePatchRequest.model_validate(
        {
            "name": "Maria Silva",
            "phone": "11988887777",
            "cpf": "111.444.777-35",
            "cidade": "São Paulo",
        },
    )
    out = await svc.patch_patient_me(user, payload)  # type: ignore[arg-type]

    mock_users.update_name_phone.assert_awaited_once_with(user.id, name="Maria Silva", phone="11988887777")
    mock_clinical.upsert_paciente_perfil.assert_awaited_once()
    call_args = mock_clinical.upsert_paciente_perfil.await_args
    assert call_args[0][0] == user.id
    assert call_args[0][1]["cpf"] == "11144477735"
    assert call_args[0][1]["cidade"] == "São Paulo"
    assert out.paciente.cpf == "11144477735"


@pytest.mark.asyncio
async def test_patch_patient_me_forbids_non_patient() -> None:
    user = _patient_user()
    user.role = UserRole.psychologist
    svc = ProfileService(AsyncMock())
    payload = PatientProfilePatchRequest.model_validate(
        {"name": "X", "phone": "11999999999", "cpf": "111.444.777-35", "cidade": "Y"},
    )

    with pytest.raises(ForbiddenError):
        await svc.patch_patient_me(user, payload)  # type: ignore[arg-type]
