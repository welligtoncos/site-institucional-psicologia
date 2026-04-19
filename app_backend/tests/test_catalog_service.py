from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.core.exceptions import ForbiddenError
from app.models.user import UserRole
from app.services.catalog_service import CatalogService


def _patient_user():
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uuid4(),
        name="Paciente",
        email="p@example.com",
        phone="11999998888",
        role=UserRole.patient,
        is_active=True,
        terms_accepted_at=now,
        created_at=now,
    )


@pytest.mark.asyncio
async def test_catalog_patient_ok() -> None:
    psych_user = SimpleNamespace(
        id=uuid4(),
        name="Dra. Ana",
        email="ana@example.com",
        phone="11888887777",
        role=UserRole.psychologist,
        is_active=True,
        terms_accepted_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    ps = SimpleNamespace(
        id=uuid4(),
        usuario_id=psych_user.id,
        crp="06/1-SP",
        bio="Atendo adultos.",
        foto_url=None,
        especialidades="TCC, Ansiedade",
        valor_sessao_padrao=Decimal("200.00"),
        duracao_minutos_padrao=50,
        usuario=psych_user,
    )
    repo = AsyncMock()
    repo.list_psicologos_ativos_catalog = AsyncMock(return_value=[ps])

    with patch("app.services.catalog_service.ClinicalRepository", return_value=repo):
        svc = CatalogService(AsyncMock())
        out = await svc.list_psychologists_catalog(_patient_user())

    assert len(out) == 1
    assert out[0].nome == "Dra. Ana"
    assert out[0].especialidades == ["TCC", "Ansiedade"]
    assert out[0].valor_consulta == Decimal("200.00")


@pytest.mark.asyncio
async def test_catalog_rejects_non_patient() -> None:
    admin = SimpleNamespace(
        id=uuid4(),
        name="Admin",
        email="a@example.com",
        phone="",
        role=UserRole.admin,
        is_active=True,
        terms_accepted_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    repo = AsyncMock()
    with patch("app.services.catalog_service.ClinicalRepository", return_value=repo):
        svc = CatalogService(AsyncMock())
        with pytest.raises(ForbiddenError):
            await svc.list_psychologists_catalog(admin)
    repo.list_psicologos_ativos_catalog.assert_not_awaited()
