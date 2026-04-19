"""
Validação Pydantic do cadastro de paciente (RF-001): telefone, aceite de termos e resposta pública.
"""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.user import UserRole
from app.schemas.auth_schema import UserRegisterRequest, UserResponse


def test_register_request_accepts_valid_payload() -> None:
    """Payload completo com accept_terms true é aceito."""
    r = UserRegisterRequest(
        name="Maria Silva",
        email="maria@example.com",
        phone="11999998888",
        password="SenhaSegura123",
        accept_terms=True,
    )
    assert r.name == "Maria Silva"
    assert r.phone == "11999998888"
    assert r.accept_terms is True


def test_register_request_strips_phone_whitespace() -> None:
    """Espaços ao redor do telefone são removidos antes da validação de tamanho."""
    r = UserRegisterRequest(
        name="A",
        email="a@example.com",
        phone="  11999998888  ",
        password="SenhaSegura123",
        accept_terms=True,
    )
    assert r.phone == "11999998888"


def test_register_request_accepts_empty_phone() -> None:
    """Telefone pode ser omitido ou vazio no cadastro de paciente."""
    r = UserRegisterRequest(
        name="Maria Silva",
        email="maria@example.com",
        password="SenhaSegura123",
        accept_terms=True,
    )
    assert r.phone == ""


def test_register_request_accepts_empty_name() -> None:
    """Nome pode ser vazio no cadastro; usuário completa depois no perfil."""
    r = UserRegisterRequest(
        email="maria@example.com",
        password="SenhaSegura123",
        accept_terms=True,
    )
    assert r.name == ""

    r2 = UserRegisterRequest.model_validate(
        {
            "name": "   ",
            "email": "x@example.com",
            "password": "SenhaSegura123",
            "accept_terms": True,
        }
    )
    assert r2.name == ""


def test_register_request_rejects_phone_too_short_when_informed() -> None:
    """Telefone informado com menos de 8 caracteres após o trim falha."""
    with pytest.raises(ValidationError) as exc:
        UserRegisterRequest(
            name="A",
            email="a@example.com",
            phone="1234567",
            password="SenhaSegura123",
            accept_terms=True,
        )
    errs = exc.value.errors()
    assert any(e.get("type") == "value_error" or "phone" in str(e.get("loc", ())) for e in errs)


def test_register_request_requires_accept_terms_field() -> None:
    """Sem accept_terms o schema não valida."""
    with pytest.raises(ValidationError):
        UserRegisterRequest.model_validate(
            {
                "name": "A",
                "email": "a@example.com",
                "phone": "11999998888",
                "password": "SenhaSegura123",
            }
        )


def test_register_request_rejects_accept_terms_false() -> None:
    """accept_terms false não satisfaz Literal[True]."""
    with pytest.raises(ValidationError):
        UserRegisterRequest.model_validate(
            {
                "name": "A",
                "email": "a@example.com",
                "phone": "11999998888",
                "password": "SenhaSegura123",
                "accept_terms": False,
            }
        )


def test_user_response_maps_user_like_object() -> None:
    """UserResponse expõe phone e terms_accepted_at a partir do ORM ou objeto similar."""
    now = datetime.now(timezone.utc)
    uid = uuid4()
    obj = SimpleNamespace(
        id=uid,
        name="Maria",
        email="maria@example.com",
        phone="11988887777",
        role=UserRole.patient,
        is_active=True,
        terms_accepted_at=now,
        created_at=now,
    )
    out = UserResponse.model_validate(obj)
    assert out.id == uid
    assert out.phone == "11988887777"
    assert out.terms_accepted_at == now
    assert out.role.value == "patient"


def test_user_response_allows_null_terms_for_legacy_rows() -> None:
    """Usuários antigos sem data de aceite aparecem com terms_accepted_at nulo."""
    now = datetime.now(timezone.utc)
    uid = uuid4()
    obj = SimpleNamespace(
        id=uid,
        name="Legado",
        email="old@example.com",
        phone="",
        role=UserRole.patient,
        is_active=True,
        terms_accepted_at=None,
        created_at=now,
    )
    out = UserResponse.model_validate(obj)
    assert out.terms_accepted_at is None
    assert out.phone == ""
