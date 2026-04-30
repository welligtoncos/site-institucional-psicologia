"""
Persistência de `User` — apenas SQLAlchemy / `AsyncSession` (sem regra de negócio).
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
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

    async def update_name_phone(self, user_id: UUID, *, name: str, phone: str) -> User:
        user = await self.get_by_id(user_id)
        if user is None:
            raise NotFoundError("Usuário não encontrado.")
        user.name = name.strip()
        user.phone = phone.strip()
        await self._db.commit()
        await self._db.refresh(user)
        return user

    async def create(
        self,
        *,
        name: str,
        email: str,
        phone: str,
        password_hash: str,
        role: UserRole = UserRole.patient,
        terms_accepted_at: datetime | None = None,
    ) -> User:
        user = User(
            name=name.strip(),
            email=email,
            phone=phone.strip(),
            password_hash=password_hash,
            role=role,
            terms_accepted_at=terms_accepted_at,
        )
        self._db.add(user)
        try:
            await self._db.commit()
        except IntegrityError as exc:
            await self._db.rollback()
            raise ConflictError("E-mail já cadastrado.") from exc
        await self._db.refresh(user)
        return user

    async def delete_by_id(self, user_id: UUID) -> None:
        """Remove usuário (uso interno, ex.: compensação após falha no perfil clínico)."""
        await self._db.execute(delete(User).where(User.id == user_id))
        await self._db.commit()

    async def set_is_active(self, user_id: UUID, *, is_active: bool) -> User:
        user = await self.get_by_id(user_id)
        if user is None:
            raise NotFoundError("Usuário não encontrado.")
        user.is_active = is_active
        await self._db.commit()
        await self._db.refresh(user)
        return user

    async def update_admin_contact(
        self,
        user_id: UUID,
        *,
        name: str | None = None,
        phone: str | None = None,
        email: str | None = None,
    ) -> User:
        user = await self.get_by_id(user_id)
        if user is None:
            raise NotFoundError("Usuário não encontrado.")
        if name is not None:
            user.name = name.strip()
        if phone is not None:
            user.phone = phone.strip()
        if email is not None:
            norm = str(email).strip().lower()
            other = await self.get_by_email(norm)
            if other is not None and other.id != user_id:
                raise ConflictError("E-mail já cadastrado para outro usuário.")
            user.email = norm
        try:
            await self._db.commit()
        except IntegrityError as exc:
            await self._db.rollback()
            raise ConflictError("Não foi possível atualizar o e-mail (duplicado?).") from exc
        await self._db.refresh(user)
        return user
