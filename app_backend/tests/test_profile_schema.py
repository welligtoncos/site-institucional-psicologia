"""Schemas de perfil de paciente — validação de PATCH."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.profile_schema import PatientProfilePatchRequest


def _minimal_valid() -> dict:
    return {
        "name": "Maria Silva",
        "phone": "11999998888",
        "cpf": "111.444.777-35",
    }


def test_patch_requires_name_phone_cpf() -> None:
    body = PatientProfilePatchRequest.model_validate(
        {
            **_minimal_valid(),
            "logradouro": " Rua A ",
            "cidade": "São Paulo",
            "uf": "sp",
            "data_nascimento": "1990-05-20",
        },
    )
    assert body.name == "Maria Silva"
    assert body.phone == "11999998888"
    assert body.cpf == "11144477735"
    assert body.logradouro == "Rua A"
    assert body.uf == "SP"
    assert body.data_nascimento == date(1990, 5, 20)


def test_patch_rejects_empty_body() -> None:
    with pytest.raises(ValidationError):
        PatientProfilePatchRequest.model_validate({})


def test_patch_rejects_future_birth() -> None:
    future = (date.today() + timedelta(days=1)).isoformat()
    with pytest.raises(ValidationError, match="futura"):
        PatientProfilePatchRequest.model_validate({**_minimal_valid(), "data_nascimento": future})
