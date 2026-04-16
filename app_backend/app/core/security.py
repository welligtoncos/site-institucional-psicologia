"""
Senhas com bcrypt e JWT (access + refresh) via python-jose.
Decodificação com tratamento explícito de expiração e assinatura inválida.
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import bcrypt
from jose import jwt

from app.core.config import get_settings

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def hash_password(plain_password: str) -> str:
    """Gera hash bcrypt (salt incluído na string)."""
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Compara senha em texto com o hash armazenado."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except ValueError:
        return False


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(*, subject: str) -> str:
    """JWT de acesso; `sub` = id do usuário (string)."""
    settings = get_settings()
    expire = _now_utc() + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": TOKEN_TYPE_ACCESS,
        "jti": str(uuid4()),
        "exp": int(expire.timestamp()),
        "iat": int(_now_utc().timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(*, subject: str) -> str:
    """JWT de renovação; TTL maior que o access token."""
    settings = get_settings()
    expire = _now_utc() + timedelta(days=settings.refresh_token_expire_days)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": TOKEN_TYPE_REFRESH,
        "jti": str(uuid4()),
        "exp": int(expire.timestamp()),
        "iat": int(_now_utc().timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """
    Decodifica e valida JWT. Levanta `jose.JWTError` ou subclasses em caso de falha.
    """
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
