"""
Persistência de `User` — apenas SQLAlchemy / `AsyncSession` (sem regra de negócio).
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.models.user import User, UserRole


class UserRepository:
    """Consultas e comandos assíncronos na tabela `users`."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, user_id: UUID) -> User | None:
        return await self._db.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        result = await self._db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        name: str,
        email: str,
        password_hash: str,
        role: UserRole = UserRole.user,
    ) -> User:
        user = User(
            name=name.strip(),
            email=email,
            password_hash=password_hash,
            role=role,
        )
        self._db.add(user)
        try:
            await self._db.commit()
        except IntegrityError as exc:
            await self._db.rollback()
            raise ConflictError("E-mail já cadastrado.") from exc
        await self._db.refresh(user)
        return user
