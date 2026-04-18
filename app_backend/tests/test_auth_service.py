"""
Regras de negócio de cadastro e login (`AuthService`).

O repositório de usuários é mockado: registro RF-001 (paciente, telefone, termos),
conflito de e-mail, login (sucesso e falhas), refresh. Validação fina de schema
em `test_auth_schema.py`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.core.exceptions import AuthenticationError, ConflictError
from app.models.user import UserRole
from app.schemas.auth_schema import UserLoginRequest, UserRegisterRequest
from app.services.auth_service import AuthService


def _user(
    *,
    user_id=None,
    email: str = "maria@example.com",
    phone: str = "11999998888",
    password_plain: str = "SenhaSegura123",
    role: UserRole = UserRole.patient,
    is_active: bool = True,
    terms_accepted_at=None,
):
    """Monta um usuário fake (com hash real de senha) para os mocks do repositório."""
    from app.core.security import hash_password

    uid = user_id or uuid4()
    if terms_accepted_at is None:
        terms_accepted_at = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=uid,
        name="Maria",
        email=email,
        phone=phone,
        password_hash=hash_password(password_plain),
        role=role,
        is_active=is_active,
        terms_accepted_at=terms_accepted_at,
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def mock_db() -> AsyncMock:
    """Sessão de banco fictícia: o `AuthService` só precisa dela para instanciar o repositório."""
    return AsyncMock()


@pytest.mark.asyncio
async def test_register_creates_patient(mock_db: AsyncMock) -> None:
    """Registro grava papel paciente, normaliza e-mail para minúsculas."""
    with patch("app.services.auth_service.UserRepository") as repo_cls:
        repo = AsyncMock()
        repo_cls.return_value = repo
        created = _user(role=UserRole.patient)
        repo.get_by_email = AsyncMock(return_value=None)
        repo.create = AsyncMock(return_value=created)

        svc = AuthService(mock_db)
        req = UserRegisterRequest(
            name="Maria",
            email="Maria@Example.com",
            phone="11999998888",
            password="SenhaSegura123",
            accept_terms=True,
        )
        out = await svc.register(req)

        repo.get_by_email.assert_awaited_once_with("maria@example.com")
        create_kw = repo.create.await_args.kwargs
        assert create_kw["role"] == UserRole.patient
        assert create_kw["phone"] == "11999998888"
        assert create_kw["terms_accepted_at"] is not None
        assert out.email == "maria@example.com"
        assert out.phone == "11999998888"
        assert out.terms_accepted_at is not None
        assert out.role.value == "patient"


@pytest.mark.asyncio
async def test_register_conflict_email(mock_db: AsyncMock) -> None:
    """E-mail já existente dispara conflito e não chama create."""
    existing = _user()
    with patch("app.services.auth_service.UserRepository") as repo_cls:
        repo = AsyncMock()
        repo_cls.return_value = repo
        repo.get_by_email = AsyncMock(return_value=existing)

        svc = AuthService(mock_db)
        req = UserRegisterRequest(
            name="X",
            email="maria@example.com",
            phone="11999998888",
            password="SenhaSegura123",
            accept_terms=True,
        )
        with pytest.raises(ConflictError, match="E-mail já cadastrado"):
            await svc.register(req)
        repo.create.assert_not_called()


@pytest.mark.asyncio
async def test_register_passes_stripped_phone_to_repository(mock_db: AsyncMock) -> None:
    """Telefone já normalizado pelo schema chega assim no create do repositório."""
    with patch("app.services.auth_service.UserRepository") as repo_cls:
        repo = AsyncMock()
        repo_cls.return_value = repo
        created = _user(role=UserRole.patient, phone="11999998888")
        repo.get_by_email = AsyncMock(return_value=None)
        repo.create = AsyncMock(return_value=created)

        svc = AuthService(mock_db)
        req = UserRegisterRequest(
            name="Maria",
            email="maria@example.com",
            phone="  11999998888  ",
            password="SenhaSegura123",
            accept_terms=True,
        )
        await svc.register(req)
        assert repo.create.await_args.kwargs["phone"] == "11999998888"


@pytest.mark.asyncio
async def test_login_success(mock_db: AsyncMock) -> None:
    """Credenciais corretas retornam access e refresh token."""
    u = _user()
    with patch("app.services.auth_service.UserRepository") as repo_cls:
        repo = AsyncMock()
        repo_cls.return_value = repo
        repo.get_by_email = AsyncMock(return_value=u)

        svc = AuthService(mock_db)
        tokens = await svc.login(
            UserLoginRequest(email="maria@example.com", password="SenhaSegura123")
        )
        assert tokens.access_token
        assert tokens.refresh_token
        assert tokens.token_type == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_credentials(mock_db: AsyncMock) -> None:
    """Usuário inexistente gera erro genérico de credenciais."""
    with patch("app.services.auth_service.UserRepository") as repo_cls:
        repo = AsyncMock()
        repo_cls.return_value = repo
        repo.get_by_email = AsyncMock(return_value=None)

        svc = AuthService(mock_db)
        with pytest.raises(AuthenticationError, match="E-mail ou senha"):
            await svc.login(
                UserLoginRequest(email="x@y.com", password="SenhaSegura123")
            )


@pytest.mark.asyncio
async def test_login_wrong_password(mock_db: AsyncMock) -> None:
    """Senha incorreta gera o mesmo erro genérico (não revela se o e-mail existe)."""
    u = _user(password_plain="OutraSenha")
    with patch("app.services.auth_service.UserRepository") as repo_cls:
        repo = AsyncMock()
        repo_cls.return_value = repo
        repo.get_by_email = AsyncMock(return_value=u)

        svc = AuthService(mock_db)
        with pytest.raises(AuthenticationError, match="E-mail ou senha"):
            await svc.login(
                UserLoginRequest(email="maria@example.com", password="SenhaSegura123")
            )


@pytest.mark.asyncio
async def test_login_inactive_user(mock_db: AsyncMock) -> None:
    """Conta com is_active=False não pode autenticar."""
    u = _user(is_active=False)
    with patch("app.services.auth_service.UserRepository") as repo_cls:
        repo = AsyncMock()
        repo_cls.return_value = repo
        repo.get_by_email = AsyncMock(return_value=u)

        svc = AuthService(mock_db)
        with pytest.raises(AuthenticationError, match="desativada"):
            await svc.login(
                UserLoginRequest(email="maria@example.com", password="SenhaSegura123")
            )


@pytest.mark.asyncio
async def test_refresh_returns_new_tokens(mock_db: AsyncMock) -> None:
    """Refresh token válido gera novo par access + refresh."""
    uid = uuid4()
    u = _user(user_id=uid)
    with patch("app.services.auth_service.UserRepository") as repo_cls:
        repo = AsyncMock()
        repo_cls.return_value = repo
        repo.get_by_id = AsyncMock(return_value=u)

        svc = AuthService(mock_db)
        from app.core.security import create_refresh_token

        refresh = create_refresh_token(subject=str(uid), role=u.role.value)
        out = await svc.refresh_access_token(refresh)
        assert out.access_token
        assert out.refresh_token


@pytest.mark.asyncio
async def test_refresh_invalid_user(mock_db: AsyncMock) -> None:
    """Se o usuário do sub não existe mais, renovação falha."""
    uid = uuid4()
    with patch("app.services.auth_service.UserRepository") as repo_cls:
        repo = AsyncMock()
        repo_cls.return_value = repo
        repo.get_by_id = AsyncMock(return_value=None)

        svc = AuthService(mock_db)
        from app.core.security import create_refresh_token

        refresh = create_refresh_token(subject=str(uid), role="patient")
        with pytest.raises(AuthenticationError, match="renovação"):
            await svc.refresh_access_token(refresh)
