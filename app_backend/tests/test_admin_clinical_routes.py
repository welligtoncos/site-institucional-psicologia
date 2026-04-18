from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.exceptions import ForbiddenError
from app.models.user import UserRole
from app.routes.admin_clinical import get_clinical_directory_service
from main import app


class _SvcStub:
    async def list_patients(self, *, skip: int, limit: int):
        return {
            "items": [
                {
                    "user": {
                        "id": str(uuid4()),
                        "name": "Maria",
                        "email": "maria@example.com",
                        "phone": "11999998888",
                        "role": "patient",
                        "is_active": True,
                        "terms_accepted_at": datetime.now(timezone.utc).isoformat(),
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                    "paciente": {
                        "id": str(uuid4()),
                        "usuario_id": str(uuid4()),
                        "contato_emergencia": "Pai - 11977776666",
                        "criado_em": datetime.now(timezone.utc).isoformat(),
                    },
                }
            ],
            "skip": skip,
            "limit": limit,
        }

    async def list_psychologists(self, *, skip: int, limit: int):
        return {
            "items": [
                {
                    "user": {
                        "id": str(uuid4()),
                        "name": "Dr. João",
                        "email": "joao@example.com",
                        "phone": "11988887777",
                        "role": "psychologist",
                        "is_active": True,
                        "terms_accepted_at": datetime.now(timezone.utc).isoformat(),
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                    "psicologo": {
                        "id": str(uuid4()),
                        "usuario_id": str(uuid4()),
                        "crp": "06/123456-SP",
                        "bio": "TCC",
                        "valor_sessao_padrao": "180.00",
                        "duracao_minutos_padrao": 50,
                        "criado_em": datetime.now(timezone.utc).isoformat(),
                    },
                }
            ],
            "skip": skip,
            "limit": limit,
        }


def _override_admin_user():
    return type("U", (), {"role": UserRole.admin})()


def _override_forbidden():
    raise ForbiddenError("Acesso restrito a administradores.")


def setup_function() -> None:
    app.dependency_overrides = {}


def teardown_function() -> None:
    app.dependency_overrides = {}


def test_list_patients_admin_ok() -> None:
    from app.routes.admin_clinical import get_current_admin_user

    app.dependency_overrides[get_current_admin_user] = _override_admin_user
    app.dependency_overrides[get_clinical_directory_service] = lambda: _SvcStub()

    client = TestClient(app)
    response = client.get("/admin/patients", params={"skip": 2, "limit": 1})

    assert response.status_code == 200
    payload = response.json()
    assert payload["skip"] == 2
    assert payload["limit"] == 1
    assert payload["items"][0]["user"]["role"] == "patient"


def test_list_psychologists_admin_ok() -> None:
    from app.routes.admin_clinical import get_current_admin_user

    app.dependency_overrides[get_current_admin_user] = _override_admin_user
    app.dependency_overrides[get_clinical_directory_service] = lambda: _SvcStub()

    client = TestClient(app)
    response = client.get("/admin/psychologists")

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["user"]["role"] == "psychologist"
    assert payload["items"][0]["psicologo"]["crp"] == "06/123456-SP"


def test_list_patients_requires_admin() -> None:
    from app.routes.admin_clinical import get_current_admin_user

    app.dependency_overrides[get_current_admin_user] = _override_forbidden
    app.dependency_overrides[get_clinical_directory_service] = lambda: _SvcStub()

    client = TestClient(app)
    response = client.get("/admin/patients")

    assert response.status_code == 403
    assert "administradores" in response.json()["detail"]


def test_list_patients_limit_validation() -> None:
    from app.routes.admin_clinical import get_current_admin_user

    app.dependency_overrides[get_current_admin_user] = _override_admin_user
    app.dependency_overrides[get_clinical_directory_service] = lambda: _SvcStub()

    client = TestClient(app)
    response = client.get("/admin/patients", params={"limit": 201})

    assert response.status_code == 422
