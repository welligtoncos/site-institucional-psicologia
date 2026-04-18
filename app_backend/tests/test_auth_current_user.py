"""
Dependência usada nas rotas protegidas: validar o Bearer JWT e carregar o usuário.

Cobre token válido, ausência de token, usuário inativo, token cujo claim `role`
não bate mais com o banco (força novo login) e tokens antigos sem `role` no payload.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

from app.core.auth import get_current_admin_user, get_current_user
from app.core.config import get_settings
from app.core.exceptions import AuthenticationError, ForbiddenError
from app.core.security import TOKEN_TYPE_ACCESS
from app.models.user import UserRole


@pytest.mark.asyncio
async def test_get_current_user_success() -> None:
    """Token válido e usuário ativo no banco: retorna o mesmo objeto carregado."""
    from app.core.security import create_access_token

    uid = uuid4()
    user = SimpleNamespace(
        id=uid,
        is_active=True,
        role=UserRole.psychologist,
    )
    token = create_access_token(subject=str(uid), role=UserRole.psychologist.value)

    mock_repo = AsyncMock()
    mock_repo.get_by_id = AsyncMock(return_value=user)

    with patch("app.core.auth.UserRepository", return_value=mock_repo):
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        out = await get_current_user(credentials=creds, db=AsyncMock())

    assert out is user
    mock_repo.get_by_id.assert_awaited_once_with(uid)


@pytest.mark.asyncio
async def test_get_current_user_rejects_missing_bearer() -> None:
    """Sem header Authorization não há autenticação."""
    with pytest.raises(AuthenticationError, match="ausente"):
        await get_current_user(credentials=None, db=AsyncMock())


@pytest.mark.asyncio
async def test_get_current_user_rejects_stale_role_claim() -> None:
    """Claim role do JWT diferente do papel no banco: exige novo login."""
    from app.core.security import create_access_token

    uid = uuid4()
    token = create_access_token(subject=str(uid), role=UserRole.admin.value)
    user = SimpleNamespace(
        id=uid,
        is_active=True,
        role=UserRole.patient,
    )
    mock_repo = AsyncMock()
    mock_repo.get_by_id = AsyncMock(return_value=user)

    with patch("app.core.auth.UserRepository", return_value=mock_repo):
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with pytest.raises(AuthenticationError, match="Sessão desatualizada"):
            await get_current_user(credentials=creds, db=AsyncMock())


@pytest.mark.asyncio
async def test_get_current_user_accepts_token_without_role_claim() -> None:
    """Token sem claim role (legado): ainda aceito; perfil vem só do banco."""
    settings = get_settings()
    uid = uuid4()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=30)
    payload = {
        "sub": str(uid),
        "type": TOKEN_TYPE_ACCESS,
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)

    user = SimpleNamespace(id=uid, is_active=True, role=UserRole.patient)
    mock_repo = AsyncMock()
    mock_repo.get_by_id = AsyncMock(return_value=user)

    with patch("app.core.auth.UserRepository", return_value=mock_repo):
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        out = await get_current_user(credentials=creds, db=AsyncMock())

    assert out is user


@pytest.mark.asyncio
async def test_get_current_user_rejects_inactive() -> None:
    """Usuário inativo no banco não passa na dependência mesmo com JWT válido."""
    from app.core.security import create_access_token

    uid = uuid4()
    token = create_access_token(subject=str(uid), role=UserRole.patient.value)
    user = SimpleNamespace(id=uid, is_active=False, role=UserRole.patient)
    mock_repo = AsyncMock()
    mock_repo.get_by_id = AsyncMock(return_value=user)

    with patch("app.core.auth.UserRepository", return_value=mock_repo):
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with pytest.raises(AuthenticationError, match="não autorizado"):
            await get_current_user(credentials=creds, db=AsyncMock())


@pytest.mark.asyncio
async def test_get_current_admin_accepts_admin() -> None:
    """Administrador passa na dependência de admin."""
    admin = SimpleNamespace(role=UserRole.admin)
    out = await get_current_admin_user(admin)  # type: ignore[arg-type]
    assert out is admin


@pytest.mark.asyncio
async def test_get_current_admin_rejects_non_admin() -> None:
    """Papel diferente de admin recebe 403 de domínio."""
    user = SimpleNamespace(role=UserRole.psychologist)
    with pytest.raises(ForbiddenError, match="administradores"):
        await get_current_admin_user(user)  # type: ignore[arg-type]
