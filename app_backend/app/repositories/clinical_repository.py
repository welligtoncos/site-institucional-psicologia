"""Persistência do domínio clínico (paciente, psicólogo) — SQLAlchemy async."""

from datetime import date, time
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError
from app.models.clinical import BloqueioAgenda, DisponibilidadeSemanal, Paciente, Psicologo
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

    async def list_psicologos_ativos_catalog(self, *, skip: int = 0, limit: int = 100) -> list[Psicologo]:
        """Psicólogos com usuário ativo (para catálogo do portal do paciente)."""
        stmt = (
            select(Psicologo)
            .join(User, Psicologo.usuario_id == User.id)
            .where(User.role == UserRole.psychologist)
            .where(User.is_active.is_(True))
            .options(selectinload(Psicologo.usuario))
            .order_by(User.name.asc())
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
        crp: str | None = None,
        bio: str | None = None,
        foto_url: str | None = None,
        especialidades: str | None = None,
        valor_sessao_padrao=None,
        duracao_minutos_padrao: int | None = None,
    ) -> Psicologo:
        row = await self.get_psicologo_by_usuario_id(usuario_id)
        if row is None:
            raise NotFoundError("Perfil de psicólogo não encontrado.")
        if crp is not None:
            row.crp = crp.strip()
        if bio is not None:
            row.bio = bio
        if foto_url is not None:
            row.foto_url = foto_url if foto_url.strip() else None
        if especialidades is not None:
            row.especialidades = especialidades if especialidades.strip() else None
        if valor_sessao_padrao is not None:
            row.valor_sessao_padrao = valor_sessao_padrao
        if duracao_minutos_padrao is not None:
            row.duracao_minutos_padrao = duracao_minutos_padrao
        try:
            await self._db.commit()
        except IntegrityError as exc:
            await self._db.rollback()
            raise ConflictError("CRP já cadastrado para outro profissional.") from exc
        await self._db.refresh(row)
        return row

    async def list_disponibilidade_semanal(self, psicologo_id: UUID) -> list[DisponibilidadeSemanal]:
        stmt = (
            select(DisponibilidadeSemanal)
            .where(DisponibilidadeSemanal.psicologo_id == psicologo_id)
            .order_by(DisponibilidadeSemanal.dia_semana, DisponibilidadeSemanal.hora_inicio)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def replace_disponibilidade_semanal(
        self,
        psicologo_id: UUID,
        *,
        slots: list[tuple[int, bool, time, time]],
    ) -> None:
        await self._db.execute(
            delete(DisponibilidadeSemanal).where(DisponibilidadeSemanal.psicologo_id == psicologo_id)
        )
        for dia_semana, ativo, hora_inicio, hora_fim in slots:
            self._db.add(
                DisponibilidadeSemanal(
                    psicologo_id=psicologo_id,
                    dia_semana=dia_semana,
                    ativo=ativo,
                    hora_inicio=hora_inicio,
                    hora_fim=hora_fim,
                )
            )
        await self._db.commit()

    async def list_bloqueios_agenda(self, psicologo_id: UUID) -> list[BloqueioAgenda]:
        stmt = (
            select(BloqueioAgenda)
            .where(BloqueioAgenda.psicologo_id == psicologo_id)
            .order_by(BloqueioAgenda.data_bloqueio, BloqueioAgenda.hora_inicio)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def replace_bloqueios_agenda(
        self,
        psicologo_id: UUID,
        *,
        rows: list[tuple[date, bool, time | None, time | None, str]],
    ) -> None:
        await self._db.execute(delete(BloqueioAgenda).where(BloqueioAgenda.psicologo_id == psicologo_id))
        for data_bloqueio, dia_inteiro, hora_inicio, hora_fim, motivo in rows:
            self._db.add(
                BloqueioAgenda(
                    psicologo_id=psicologo_id,
                    data_bloqueio=data_bloqueio,
                    dia_inteiro=dia_inteiro,
                    hora_inicio=hora_inicio,
                    hora_fim=hora_fim,
                    motivo=motivo,
                )
            )
        await self._db.commit()
