"""Persistência do domínio clínico (paciente, psicólogo) — SQLAlchemy async."""

from datetime import date, datetime, time, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError
from app.models.clinical import (
    BloqueioAgenda,
    Cobranca,
    CobrancaStatusGateway,
    Consulta,
    ConsultaModalidade,
    ConsultaSituacaoPagamento,
    ConsultaStatus,
    DisponibilidadeSemanal,
    Paciente,
    Psicologo,
    SessaoAoVivo,
    SessaoAoVivoFase,
)
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

    async def get_psicologo_ativo_by_id(self, psicologo_id: UUID) -> Psicologo | None:
        """Psicólogo com usuário ativo (catálogo / agendamento paciente)."""
        stmt = (
            select(Psicologo)
            .join(User, Psicologo.usuario_id == User.id)
            .where(Psicologo.id == psicologo_id)
            .where(User.role == UserRole.psychologist)
            .where(User.is_active.is_(True))
            .options(selectinload(Psicologo.usuario))
        )
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_consultas_psicologo_no_periodo(
        self,
        psicologo_id: UUID,
        data_inicio: date,
        data_fim: date,
    ) -> list[Consulta]:
        """Consultas que ainda ocupam o horário (só agendada, confirmada ou em andamento)."""
        stmt = (
            select(Consulta)
            .where(Consulta.psicologo_id == psicologo_id)
            .where(Consulta.data_agendada >= data_inicio)
            .where(Consulta.data_agendada <= data_fim)
            .where(
                or_(
                    Consulta.status.in_(
                        [
                            ConsultaStatus.confirmada,
                            ConsultaStatus.em_andamento,
                        ],
                    ),
                    and_(
                        Consulta.status == ConsultaStatus.agendada,
                        Consulta.situacao_pagamento == ConsultaSituacaoPagamento.pago,
                    ),
                )
            )
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def list_consultas_psicologo_desde(
        self,
        psicologo_id: UUID,
        data_inicio: date,
    ) -> list[Consulta]:
        """Consultas do psicólogo a partir da data informada, com paciente carregado."""
        stmt = (
            select(Consulta)
            .where(Consulta.psicologo_id == psicologo_id)
            .where(Consulta.data_agendada >= data_inicio)
            .options(selectinload(Consulta.paciente).selectinload(Paciente.usuario))
            .options(selectinload(Consulta.sessao_ao_vivo))
            .options(selectinload(Consulta.cobranca))
            .order_by(Consulta.data_agendada.asc(), Consulta.hora_inicio.asc())
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().unique().all())

    async def create_consulta_com_cobranca(
        self,
        *,
        paciente_id: UUID,
        psicologo_id: UUID,
        data_agendada: date,
        hora_inicio: time,
        duracao_minutos: int,
        modalidade: ConsultaModalidade | str,
        valor_acordado,
        especialidade_atendida: str,
        id_intent_gateway: str,
        provedor_gateway: str = "stripe_compatible_mock",
    ) -> tuple[Consulta, Cobranca]:
        # Pagamento pendente não deve bloquear agenda:
        # se já existe reserva "agendada + pendente" no mesmo slot, expiramos essa reserva antes de inserir.
        stmt_pending_same_slot = (
            select(Consulta)
            .join(Cobranca, Cobranca.consulta_id == Consulta.id)
            .where(Consulta.psicologo_id == psicologo_id)
            .where(Consulta.data_agendada == data_agendada)
            .where(Consulta.hora_inicio == hora_inicio)
            .where(Consulta.status == ConsultaStatus.agendada)
            .where(Consulta.situacao_pagamento == ConsultaSituacaoPagamento.pendente)
            .where(Cobranca.status_gateway == CobrancaStatusGateway.awaiting_payment)
            .options(selectinload(Consulta.cobranca))
        )
        pending_result = await self._db.execute(stmt_pending_same_slot)
        for existing in list(pending_result.scalars().unique().all()):
            existing.status = ConsultaStatus.cancelada
            if existing.cobranca is not None:
                existing.cobranca.status_gateway = CobrancaStatusGateway.failed

        consulta = Consulta(
            paciente_id=paciente_id,
            psicologo_id=psicologo_id,
            data_agendada=data_agendada,
            hora_inicio=hora_inicio,
            duracao_minutos=duracao_minutos,
            modalidade=modalidade,
            status=ConsultaStatus.agendada,
            situacao_pagamento=ConsultaSituacaoPagamento.pendente,
            valor_acordado=valor_acordado,
            especialidade_atendida=especialidade_atendida,
            observacoes="",
        )
        self._db.add(consulta)
        await self._db.flush()
        cobranca = Cobranca(
            consulta_id=consulta.id,
            valor_centavos=int(round(float(valor_acordado) * 100)),
            moeda="BRL",
            provedor_gateway=provedor_gateway,
            id_intent_gateway=id_intent_gateway,
            status_gateway=CobrancaStatusGateway.awaiting_payment,
        )
        self._db.add(cobranca)
        try:
            await self._db.commit()
        except IntegrityError as exc:
            await self._db.rollback()
            raise ConflictError("Já existe consulta ativa para este profissional neste horário.") from exc
        await self._db.refresh(consulta)
        await self._db.refresh(cobranca)
        return consulta, cobranca

    async def get_consulta_com_cobranca_do_paciente(
        self,
        consulta_id: UUID,
        usuario_id: UUID,
    ) -> Consulta | None:
        stmt = (
            select(Consulta)
            .join(Paciente, Consulta.paciente_id == Paciente.id)
            .where(Consulta.id == consulta_id)
            .where(Paciente.usuario_id == usuario_id)
            .options(
                selectinload(Consulta.paciente).selectinload(Paciente.usuario),
                selectinload(Consulta.psicologo).selectinload(Psicologo.usuario),
                selectinload(Consulta.cobranca),
                selectinload(Consulta.sessao_ao_vivo),
            )
        )
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_consultas_com_cobranca_do_paciente_desde(
        self,
        usuario_id: UUID,
        data_inicio: date,
    ) -> list[Consulta]:
        stmt = (
            select(Consulta)
            .join(Paciente, Consulta.paciente_id == Paciente.id)
            .where(Paciente.usuario_id == usuario_id)
            .where(Consulta.data_agendada >= data_inicio)
            .options(
                selectinload(Consulta.paciente).selectinload(Paciente.usuario),
                selectinload(Consulta.psicologo).selectinload(Psicologo.usuario),
                selectinload(Consulta.cobranca),
                selectinload(Consulta.sessao_ao_vivo),
            )
            .order_by(Consulta.data_agendada.asc(), Consulta.hora_inicio.asc())
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_consulta_com_cobranca_do_psicologo(
        self,
        consulta_id: UUID,
        usuario_id: UUID,
    ) -> Consulta | None:
        stmt = (
            select(Consulta)
            .join(Psicologo, Consulta.psicologo_id == Psicologo.id)
            .where(Consulta.id == consulta_id)
            .where(Psicologo.usuario_id == usuario_id)
            .options(
                selectinload(Consulta.paciente).selectinload(Paciente.usuario),
                selectinload(Consulta.psicologo).selectinload(Psicologo.usuario),
                selectinload(Consulta.cobranca),
                selectinload(Consulta.sessao_ao_vivo),
            )
        )
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def save_consulta(self, consulta: Consulta) -> Consulta:
        await self._db.commit()
        await self._db.refresh(consulta)
        return consulta

    async def upsert_sessao_patient_waiting(
        self,
        consulta: Consulta,
        *,
        joined_at: datetime,
        meet_url: str | None = None,
    ) -> SessaoAoVivo:
        sessao = consulta.sessao_ao_vivo
        if sessao is None:
            sessao = SessaoAoVivo(
                consulta_id=consulta.id,
                fase=SessaoAoVivoFase.patient_waiting,
            )
            self._db.add(sessao)
        sessao.fase = SessaoAoVivoFase.patient_waiting
        sessao.paciente_entrou_em = joined_at
        sessao.desbloqueio_play_em = joined_at
        sessao.encerrada_em = None
        if meet_url:
            sessao.url_meet = meet_url
        await self._db.commit()
        await self._db.refresh(sessao)
        return sessao

    async def upsert_sessao_live(
        self,
        consulta: Consulta,
        *,
        started_at: datetime,
        meet_url: str | None = None,
    ) -> SessaoAoVivo:
        sessao = consulta.sessao_ao_vivo
        if sessao is None:
            sessao = SessaoAoVivo(
                consulta_id=consulta.id,
                fase=SessaoAoVivoFase.live,
            )
            self._db.add(sessao)
        sessao.fase = SessaoAoVivoFase.live
        sessao.cronometro_iniciado_em = started_at
        sessao.encerrada_em = None
        if meet_url:
            sessao.url_meet = meet_url
        await self._db.commit()
        await self._db.refresh(sessao)
        return sessao

    async def mark_sessao_ended(self, consulta: Consulta, *, ended_at: datetime) -> SessaoAoVivo | None:
        sessao = consulta.sessao_ao_vivo
        if sessao is None:
            return None
        sessao.fase = SessaoAoVivoFase.ended
        sessao.encerrada_em = ended_at
        await self._db.commit()
        await self._db.refresh(sessao)
        return sessao

    async def auto_finish_live_sessions_past_duration(self, *, now: datetime | None = None) -> int:
        """Marca como realizadas consultas em andamento cujo cronômetro (live) já excedeu a duração oficial.

        Usa `cronometro_iniciado_em` + `duracao_minutos` da consulta. Idempotente para consultas já encerradas.
        Chamado em leituras frequentes (agenda) para não depender de job separado.
        """
        tz = ZoneInfo("America/Sao_Paulo")
        if now is None:
            now = datetime.now(tz)
        elif now.tzinfo is None:
            now = now.replace(tzinfo=tz)
        else:
            now = now.astimezone(tz)

        stmt = (
            select(Consulta)
            .join(SessaoAoVivo, SessaoAoVivo.consulta_id == Consulta.id)
            .where(
                Consulta.status == ConsultaStatus.em_andamento,
                SessaoAoVivo.fase == SessaoAoVivoFase.live,
                SessaoAoVivo.encerrada_em.is_(None),
                SessaoAoVivo.cronometro_iniciado_em.isnot(None),
            )
            .options(selectinload(Consulta.sessao_ao_vivo))
        )
        result = await self._db.execute(stmt)
        candidates = list(result.scalars().unique().all())
        closed = 0
        for c in candidates:
            sessao = c.sessao_ao_vivo
            if sessao is None or sessao.cronometro_iniciado_em is None:
                continue
            started = sessao.cronometro_iniciado_em
            if started.tzinfo is None:
                started = started.replace(tzinfo=tz)
            else:
                started = started.astimezone(tz)
            deadline = started + timedelta(minutes=int(c.duracao_minutos))
            if deadline > now:
                continue
            c.status = ConsultaStatus.realizada
            sessao.fase = SessaoAoVivoFase.ended
            sessao.encerrada_em = now
            closed += 1
        if closed:
            await self._db.commit()
        return closed

    async def auto_expire_unpaid_appointments(self, *, now: datetime | None = None) -> int:
        """Expira consultas não pagas cujo início já passou.

        Regra:
        - consulta `agendada`
        - pagamento da consulta ainda `pendente`
        - cobrança no gateway em `awaiting_payment`
        - data/hora de início menor ou igual ao momento atual
        """
        tz = ZoneInfo("America/Sao_Paulo")
        if now is None:
            now = datetime.now(tz)
        elif now.tzinfo is None:
            now = now.replace(tzinfo=tz)
        else:
            now = now.astimezone(tz)

        stmt = (
            select(Consulta)
            .join(Cobranca, Cobranca.consulta_id == Consulta.id)
            .where(
                Consulta.status == ConsultaStatus.agendada,
                Consulta.situacao_pagamento == ConsultaSituacaoPagamento.pendente,
                Cobranca.status_gateway == CobrancaStatusGateway.awaiting_payment,
            )
            .options(selectinload(Consulta.cobranca))
        )
        result = await self._db.execute(stmt)
        candidates = list(result.scalars().unique().all())

        expired = 0
        for consulta in candidates:
            starts_at = datetime.combine(consulta.data_agendada, consulta.hora_inicio, tzinfo=tz)
            if starts_at > now:
                continue
            consulta.status = ConsultaStatus.cancelada
            if consulta.cobranca is not None:
                consulta.cobranca.status_gateway = CobrancaStatusGateway.failed
            expired += 1

        if expired:
            await self._db.commit()
        return expired

    async def mark_payment_success_for_consulta(
        self,
        consulta_id: UUID,
        *,
        default_video_link: str | None = None,
        mercadopago_payment_id: str | None = None,
    ) -> tuple[Consulta, Cobranca]:
        stmt = (
            select(Consulta)
            .where(Consulta.id == consulta_id)
            .options(selectinload(Consulta.cobranca))
        )
        result = await self._db.execute(stmt)
        consulta = result.scalar_one_or_none()
        if consulta is None or consulta.cobranca is None:
            raise NotFoundError("Consulta/cobrança não encontrada.")

        cobranca = consulta.cobranca
        if cobranca.status_gateway == CobrancaStatusGateway.succeeded:
            raise ConflictError("Pagamento já registrado.")
        if cobranca.status_gateway == CobrancaStatusGateway.failed:
            raise ConflictError("Cobrança em estado de falha.")

        cobranca.status_gateway = CobrancaStatusGateway.succeeded
        cobranca.pago_em = datetime.utcnow()
        if mercadopago_payment_id and mercadopago_payment_id.strip():
            cobranca.provedor_gateway = "mercadopago"
            cobranca.id_intent_gateway = mercadopago_payment_id.strip()[:128]
        consulta.situacao_pagamento = ConsultaSituacaoPagamento.pago
        if consulta.status == ConsultaStatus.agendada:
            consulta.status = ConsultaStatus.confirmada
        if (
            consulta.modalidade == ConsultaModalidade.online
            and not consulta.link_videochamada_opcional
            and default_video_link
        ):
            consulta.link_videochamada_opcional = default_video_link

        await self._db.commit()
        await self._db.refresh(consulta)
        await self._db.refresh(cobranca)
        return consulta, cobranca

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

    async def list_bloqueios_agenda_desde(self, psicologo_id: UUID, data_inicio: date) -> list[BloqueioAgenda]:
        stmt = (
            select(BloqueioAgenda)
            .where(BloqueioAgenda.psicologo_id == psicologo_id)
            .where(BloqueioAgenda.data_bloqueio >= data_inicio)
            .order_by(BloqueioAgenda.data_bloqueio.asc(), BloqueioAgenda.hora_inicio.asc())
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
