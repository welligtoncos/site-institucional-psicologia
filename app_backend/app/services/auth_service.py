"""
Casos de uso de autenticação: cadastro e login. Sem SQL direto — repositórios.
Cadastro de paciente cria `users` + `pacientes`; psicólogo cria `users` + `psicologos`.
"""

from datetime import datetime, timezone
from decimal import Decimal
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
from app.repositories.clinical_repository import ClinicalRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth_schema import (
    PsychologistRegisterRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._users = UserRepository(db)
        self._clinical = ClinicalRepository(db)

    async def register(self, data: UserRegisterRequest) -> UserResponse:
        """Cadastro de paciente (RF-001): `users` + perfil `pacientes`."""
        return await self._register_patient_profile(data)

    async def _register_patient_profile(self, data: UserRegisterRequest) -> UserResponse:
        email_norm = str(data.email).strip().lower()
        if await self._users.get_by_email(email_norm) is not None:
            raise ConflictError("E-mail já cadastrado.")

        pwd_hash = hash_password(data.password)
        accepted_at = datetime.now(timezone.utc)
        user = await self._users.create(
            name=data.name,
            email=email_norm,
            phone=data.phone,
            password_hash=pwd_hash,
            role=UserRole.patient,
            terms_accepted_at=accepted_at,
        )
        try:
            await self._clinical.create_paciente(
                usuario_id=user.id,
                contato_emergencia=data.contato_emergencia,
            )
        except ConflictError:
            await self._users.delete_by_id(user.id)
            raise
        return UserResponse.model_validate(user)

    async def register_psychologist(self, data: PsychologistRegisterRequest) -> UserResponse:
        """Cadastro de psicólogo: `users` (papel psychologist) + `psicologos`."""
        email_norm = str(data.email).strip().lower()
        if await self._users.get_by_email(email_norm) is not None:
            raise ConflictError("E-mail já cadastrado.")

        pwd_hash = hash_password(data.password)
        accepted_at = datetime.now(timezone.utc)
        user = await self._users.create(
            name=data.name,
            email=email_norm,
            phone=data.phone,
            password_hash=pwd_hash,
            role=UserRole.psychologist,
            terms_accepted_at=accepted_at,
        )
        valor = data.valor_sessao_padrao if data.valor_sessao_padrao is not None else Decimal("0")
        duracao = data.duracao_minutos_padrao if data.duracao_minutos_padrao is not None else 50
        try:
            await self._clinical.create_psicologo(
                usuario_id=user.id,
                crp=data.crp,
                bio=data.bio or "",
                valor_sessao_padrao=valor,
                duracao_minutos_padrao=duracao,
            )
        except ConflictError:
            await self._users.delete_by_id(user.id)
            raise
        return UserResponse.model_validate(user)

    async def login(self, data: UserLoginRequest) -> TokenResponse:
        """Credenciais válidas e conta ativa → access + refresh JWT."""
        email_norm = str(data.email).strip().lower()
        user = await self._users.get_by_email(email_norm)
        if user is None or not verify_password(data.password, user.password_hash):
            raise AuthenticationError("E-mail ou senha inválidos.")
        if not user.is_active:
            raise AuthenticationError("Conta desativada.")

        access = create_access_token(subject=str(user.id), role=user.role.value)
        refresh = create_refresh_token(subject=str(user.id), role=user.role.value)
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

        access = create_access_token(subject=str(user.id), role=user.role.value)
        refresh = create_refresh_token(subject=str(user.id), role=user.role.value)
        return TokenResponse(access_token=access, refresh_token=refresh)
