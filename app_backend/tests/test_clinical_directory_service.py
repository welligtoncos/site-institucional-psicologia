from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.models.user import UserRole
from app.services.clinical_directory_service import ClinicalDirectoryService


def _user(role: UserRole) -> SimpleNamespace:
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid4(),
        name="Pessoa Teste",
        email=f"{role.value}@example.com",
        phone="11999998888",
        role=role,
        is_active=True,
        terms_accepted_at=now,
        created_at=now,
    )


@pytest.mark.asyncio
async def test_list_patients_maps_repository_rows() -> None:
    repo = AsyncMock()
    patient_user = _user(UserRole.patient)
    paciente = SimpleNamespace(
        id=uuid4(),
        usuario_id=patient_user.id,
        contato_emergencia="Mãe - 11988887777",
        cpf=None,
        data_nascimento=None,
        cep=None,
        logradouro=None,
        numero=None,
        complemento=None,
        bairro=None,
        cidade=None,
        uf=None,
        ponto_referencia=None,
        criado_em=datetime.now(timezone.utc),
        usuario=patient_user,
    )
    repo.list_pacientes = AsyncMock(return_value=[paciente])

    with patch("app.services.clinical_directory_service.ClinicalRepository", return_value=repo):
        svc = ClinicalDirectoryService(AsyncMock())
        out = await svc.list_patients(skip=0, limit=50)

    repo.list_pacientes.assert_awaited_once_with(skip=0, limit=50)
    assert out.skip == 0
    assert out.limit == 50
    assert len(out.items) == 1
    assert out.items[0].user.role.value == "patient"
    assert out.items[0].paciente.contato_emergencia == "Mãe - 11988887777"


@pytest.mark.asyncio
async def test_list_psychologists_maps_repository_rows() -> None:
    repo = AsyncMock()
    psych_user = _user(UserRole.psychologist)
    psicologo = SimpleNamespace(
        id=uuid4(),
        usuario_id=psych_user.id,
        crp="06/123456-SP",
        bio="TCC",
        foto_url=None,
        especialidades=None,
        valor_sessao_padrao=Decimal("190.00"),
        duracao_minutos_padrao=50,
        criado_em=datetime.now(timezone.utc),
        usuario=psych_user,
    )
    repo.list_psicologos = AsyncMock(return_value=[psicologo])

    with patch("app.services.clinical_directory_service.ClinicalRepository", return_value=repo):
        svc = ClinicalDirectoryService(AsyncMock())
        out = await svc.list_psychologists(skip=5, limit=10)

    repo.list_psicologos.assert_awaited_once_with(skip=5, limit=10)
    assert out.skip == 5
    assert out.limit == 10
    assert len(out.items) == 1
    assert out.items[0].user.role.value == "psychologist"
    assert out.items[0].psicologo.crp == "06/123456-SP"
