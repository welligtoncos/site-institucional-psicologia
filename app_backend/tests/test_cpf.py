"""Validação de CPF (normalização e dígitos verificadores)."""

from __future__ import annotations

import pytest

from app.core.cpf import cpf_is_valid, normalize_cpf_digits, parse_and_validate_cpf


def test_normalize_cpf_accepts_punctuation() -> None:
    assert normalize_cpf_digits("111.444.777-35") == "11144477735"


def test_normalize_cpf_rejects_wrong_length() -> None:
    with pytest.raises(ValueError, match="11"):
        normalize_cpf_digits("123")


def test_parse_and_validate_accepts_valid() -> None:
    assert parse_and_validate_cpf("111.444.777-35") == "11144477735"


def test_parse_and_validate_rejects_invalid() -> None:
    with pytest.raises(ValueError, match="inválido"):
        parse_and_validate_cpf("111.111.111-11")


def test_cpf_is_valid_known() -> None:
    assert cpf_is_valid("11144477735") is True
    assert cpf_is_valid("11111111111") is False
