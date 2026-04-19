"""Persistência do domínio clínico (paciente, psicólogo) — SQLAlchemy async."""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError
from app.models.clinical import Paciente, Psicologo
from app.models.user import User, UserRole


class ClinicalRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_paciente_by_usuario_id(self, usuario_id: UUID) -> Paciente | None:
        result = await self._db.execute(select(Paciente).where(Paciente.usuario_id == usuario_id))
        return result.scalar_one_or_none()

    async def get_psicologo_by_usuario_id(self, usuario_id: UUID) -> Psicologo | None:
        result = await self._db.execute(select(Psicologo).where(Psicologo.usuario_id == usuario_id))
        return result.scalar_one_or_none()

    async def list_pacientes(self, *, skip: int = 0, limit: int = 50) -> list[Paciente]:
        """Lista perfis clínicos de pacientes com `users` carregado (ordenado por cadastro mais recente)."""
        stmt = (
            select(Paciente)
            .join(User, Paciente.usuario_id == User.id)
            .where(User.role == UserRole.patient)
            .options(selectinload(Paciente.usuario))
            .order_by(Paciente.criado_em.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().unique().all())

    async def list_psicologos(self, *, skip: int = 0, limit: int = 50) -> list[Psicologo]:
        """Lista perfis de psicólogos com `users` carregado."""
        stmt = (
            select(Psicologo)
            .join(User, Psicologo.usuario_id == User.id)
            .where(User.role == UserRole.psychologist)
            .options(selectinload(Psicologo.usuario))
            .order_by(Psicologo.criado_em.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().unique().all())

    async def create_paciente(self, *, usuario_id: UUID, contato_emergencia: str | None) -> Paciente:
        row = Paciente(usuario_id=usuario_id, contato_emergencia=contato_emergencia)
        self._db.add(row)
        try:
            await self._db.commit()
        except IntegrityError as exc:
            await self._db.rollback()
            raise ConflictError("Não foi possível criar o perfil de paciente (dados duplicados?).") from exc
        await self._db.refresh(row)
        return row

    async def create_psicologo(
        self,
        *,
        usuario_id: UUID,
        crp: str,
        bio: str,
        valor_sessao_padrao,
        duracao_minutos_padrao: int,
    ) -> Psicologo:
        row = Psicologo(
            usuario_id=usuario_id,
            crp=crp,
            bio=bio,
            valor_sessao_padrao=valor_sessao_padrao,
            duracao_minutos_padrao=duracao_minutos_padrao,
        )
        self._db.add(row)
        try:
            await self._db.commit()
        except IntegrityError as exc:
            await self._db.rollback()
            raise ConflictError("E-mail ou CRP já cadastrado para outro profissional.") from exc
        await self._db.refresh(row)
        return row

    _PACIENTE_UPDATE_FIELDS = frozenset({
        "contato_emergencia",
        "cpf",
        "data_nascimento",
        "cep",
        "logradouro",
        "numero",
        "complemento",
        "bairro",
        "cidade",
        "uf",
        "ponto_referencia",
    })

    async def upsert_paciente_perfil(self, usuario_id: UUID, updates: dict[str, Any]) -> Paciente:
        """Cria a linha em `pacientes` se não existir e aplica os campos permitidos."""
        row = await self.get_paciente_by_usuario_id(usuario_id)
        if row is None:
            row = Paciente(usuario_id=usuario_id, contato_emergencia=None)
            self._db.add(row)
            await self._db.flush()
        for key, value in updates.items():
            if key in self._PACIENTE_UPDATE_FIELDS:
                setattr(row, key, value)
        try:
            await self._db.commit()
        except IntegrityError as exc:
            await self._db.rollback()
            raise ConflictError("CPF já cadastrado para outro paciente.") from exc
        await self._db.refresh(row)
        return row

    async def update_psicologo_perfil(
        self,
        usuario_id: UUID,
        *,
        bio: str | None = None,
        valor_sessao_padrao=None,
        duracao_minutos_padrao: int | None = None,
    ) -> Psicologo:
        row = await self.get_psicologo_by_usuario_id(usuario_id)
        if row is None:
            raise NotFoundError("Perfil de psicólogo não encontrado.")
        if bio is not None:
            row.bio = bio
        if valor_sessao_padrao is not None:
            row.valor_sessao_padrao = valor_sessao_padrao
        if duracao_minutos_padrao is not None:
            row.duracao_minutos_padrao = duracao_minutos_padrao
        await self._db.commit()
        await self._db.refresh(row)
        return row
