"""
Camada baixa de autenticação: bcrypt e JWT.

Verifica que a senha vira hash e a comparação funciona; que os tokens de acesso
e refresh trazem sub, tipo, role e datas; e que a assinatura usa a SECRET_KEY da config.
Não usa banco nem HTTP — só funções puras de `app.core.security`.
"""

from __future__ import annotations

from jose import jwt

from app.core.config import get_settings
from app.core.security import (
    TOKEN_TYPE_ACCESS,
    TOKEN_TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify_password_roundtrip() -> None:
    """Senha correta confere com o hash; senha errada não confere."""
    raw = "SenhaSegura123"
    h = hash_password(raw)
    assert h != raw
    assert verify_password(raw, h) is True
    assert verify_password("outra", h) is False


def test_verify_password_rejects_invalid_hash() -> None:
    """Hash malformado não deve quebrar a verificação (retorna False)."""
    assert verify_password("x", "not-a-valid-bcrypt-string") is False


def test_access_token_contains_sub_type_and_role() -> None:
    """JWT de acesso decodifica com sub, type, role e timestamps."""
    sub = "550e8400-e29b-41d4-a716-446655440000"
    role = "patient"
    token = create_access_token(subject=sub, role=role)
    payload = decode_token(token)
    assert payload["sub"] == sub
    assert payload["type"] == TOKEN_TYPE_ACCESS
    assert payload["role"] == role
    assert "exp" in payload and "iat" in payload


def test_refresh_token_contains_sub_type_and_role() -> None:
    """JWT de refresh decodifica com sub, type, role e timestamps."""
    sub = "550e8400-e29b-41d4-a716-446655440000"
    role = "psychologist"
    token = create_refresh_token(subject=sub, role=role)
    payload = decode_token(token)
    assert payload["sub"] == sub
    assert payload["type"] == TOKEN_TYPE_REFRESH
    assert payload["role"] == role


def test_token_signed_with_configured_secret() -> None:
    """Token é válido quando verificado com SECRET_KEY e ALGORITHM da config."""
    token = create_access_token(subject="550e8400-e29b-41d4-a716-446655440000", role="admin")
    settings = get_settings()
    decoded = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    assert decoded["role"] == "admin"
