"""
Dependências de autenticação/autorização para endpoints protegidos.
"""

from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from jose.exceptions import ExpiredSignatureError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AuthenticationError
from app.core.security import TOKEN_TYPE_ACCESS, decode_token
from app.models.user import User
from app.repositories.user_repository import UserRepository

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    REQ: tratamento adequado para token inválido ou expirado.
    """
    if credentials is None:
        raise AuthenticationError("Token de acesso ausente.")

    try:
        payload = decode_token(credentials.credentials)
    except ExpiredSignatureError as exc:
        raise AuthenticationError("Token expirado. Faça login novamente.") from exc
    except JWTError as exc:
        raise AuthenticationError("Token inválido.") from exc

    token_type = payload.get("type")
    subject = payload.get("sub")
    if token_type != TOKEN_TYPE_ACCESS or not isinstance(subject, str) or not subject:
        raise AuthenticationError("Token inválido.")

    try:
        user_id = UUID(subject)
    except ValueError as exc:
        raise AuthenticationError("Token inválido.") from exc

    user = await UserRepository(db).get_by_id(user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("Usuário não autorizado.")
    return user
