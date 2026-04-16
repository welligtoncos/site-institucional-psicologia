"""
Casos de uso de autenticação: cadastro e login. Sem SQL direto — apenas `UserRepository`.
"""

from uuid import UUID

from jose import JWTError
from jose.exceptions import ExpiredSignatureError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, ConflictError
from app.core.security import (
    TOKEN_TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import UserRole
from app.repositories.user_repository import UserRepository
from app.schemas.auth_schema import (
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self._users = UserRepository(db)

    async def register(self, data: UserRegisterRequest) -> UserResponse:
        """E-mail único, hash bcrypt, perfil padrão `user`."""
        email_norm = str(data.email).strip().lower()
        if await self._users.get_by_email(email_norm) is not None:
            raise ConflictError("E-mail já cadastrado.")

        # REQ: senha armazenada de forma segura (bcrypt hash, nunca senha em texto).
        pwd_hash = hash_password(data.password)
        user = await self._users.create(
            name=data.name,
            email=email_norm,
            password_hash=pwd_hash,
            role=UserRole.user,
        )
        return UserResponse.model_validate(user)

    async def login(self, data: UserLoginRequest) -> TokenResponse:
        """Credenciais válidas e conta ativa → access + refresh JWT."""
        email_norm = str(data.email).strip().lower()
        user = await self._users.get_by_email(email_norm)
        if user is None or not verify_password(data.password, user.password_hash):
            raise AuthenticationError("E-mail ou senha inválidos.")
        if not user.is_active:
            raise AuthenticationError("Conta desativada.")

        access = create_access_token(subject=str(user.id))
        refresh = create_refresh_token(subject=str(user.id))
        # REQ: JWT ou mecanismo equivalente (access + refresh emitidos no login).
        return TokenResponse(access_token=access, refresh_token=refresh)

    async def refresh_access_token(self, refresh_token: str) -> TokenResponse:
        """
        Renovação de sessão com refresh token válido.
        REQ: fluxo claro de autenticação (login -> refresh -> acesso protegido).
        """
        try:
            payload = decode_token(refresh_token)
        except ExpiredSignatureError as exc:
            raise AuthenticationError("Refresh token expirado.") from exc
        except JWTError as exc:
            raise AuthenticationError("Refresh token inválido.") from exc
        token_type = payload.get("type")
        subject = payload.get("sub")
        if token_type != TOKEN_TYPE_REFRESH or not isinstance(subject, str) or not subject:
            raise AuthenticationError("Refresh token inválido.")

        try:
            user_id = UUID(subject)
        except ValueError as exc:
            raise AuthenticationError("Refresh token inválido.") from exc

        user = await self._users.get_by_id(user_id)
        if user is None or not user.is_active:
            raise AuthenticationError("Usuário inválido para renovação.")

        access = create_access_token(subject=str(user.id))
        refresh = create_refresh_token(subject=str(user.id))
        return TokenResponse(access_token=access, refresh_token=refresh)
