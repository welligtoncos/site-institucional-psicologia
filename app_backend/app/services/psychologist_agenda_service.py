"""Leitura da agenda do psicólogo (consultas + bloqueios futuros)."""

from datetime import date, datetime, timedelta
import logging
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.messaging.business_event_publisher import BusinessEventPublisher
from app.models.clinical import Consulta, ConsultaSituacaoPagamento, ConsultaStatus, SessaoAoVivoFase
from app.models.user import User, UserRole
from app.repositories.clinical_repository import ClinicalRepository
from app.schemas.agenda_schema import (
    PsychologistAppointmentMeetingLinkPatchRequest,
    PsychologistAppointmentNotesPatchRequest,
    PsychologistAppointmentOnlineResponse,
    PsychologistAgendaAppointmentResponse,
    PsychologistAgendaResponse,
)
from app.schemas.availability_schema import AgendaBlockResponse


logger = logging.getLogger(__name__)
CLINIC_TZ = ZoneInfo("America/Sao_Paulo")


class PsychologistAgendaService:
    def __init__(self, db: AsyncSession) -> None:
        self._clinical = ClinicalRepository(db)
        self._audit = BusinessEventPublisher()

    def _ensure_psychologist(self, user: User):
        if user.role != UserRole.psychologist:
            raise ForbiddenError("Este recurso é exclusivo para usuários com perfil de psicólogo.")

    async def _get_psicologo_id(self, user: User) -> UUID:
        self._ensure_psychologist(user)
        ps = await self._clinical.get_psicologo_by_usuario_id(user.id)
        if ps is None:
            raise NotFoundError("Perfil de psicólogo não encontrado. Conclua o cadastro ou contate o suporte.")
        return ps.id

    def _agenda_status(self, c: Consulta) -> str:
        if c.status == ConsultaStatus.agendada:
            return "pendente"
        if c.status == ConsultaStatus.confirmada:
            return "confirmada"
        if c.status == ConsultaStatus.em_andamento:
            return "em_andamento"
        if c.status == ConsultaStatus.cancelada:
            return "cancelada"
        return "realizada"

    def _is_patient_online(self, c: Consulta) -> bool:
        sessao = getattr(c, "sessao_ao_vivo", None)
        if sessao is None:
            return False
        if sessao.encerrada_em is not None:
            return False
        return sessao.fase in (SessaoAoVivoFase.patient_waiting, SessaoAoVivoFase.live) and sessao.paciente_entrou_em is not None

    def _session_phase(self, c: Consulta) -> str | None:
        sessao = getattr(c, "sessao_ao_vivo", None)
        if sessao is None or getattr(sessao, "fase", None) is None:
            return None
        return sessao.fase.value

    def _to_appointment_row(self, c: Consulta) -> PsychologistAgendaAppointmentResponse:
        patient_name = c.paciente.usuario.name.strip() if c.paciente and c.paciente.usuario and c.paciente.usuario.name else "Paciente"
        sessao = getattr(c, "sessao_ao_vivo", None)
        video_link = c.link_videochamada_opcional
        if sessao is not None and getattr(sessao, "url_meet", None):
            video_link = sessao.url_meet
        return PsychologistAgendaAppointmentResponse(
            id=c.id,
            patient_id=c.paciente_id,
            patient_name=patient_name,
            iso_date=c.data_agendada.isoformat(),
            time=c.hora_inicio.strftime("%H:%M"),
            format=c.modalidade.value,
            status=self._agenda_status(c),
            payment_pending=c.situacao_pagamento == ConsultaSituacaoPagamento.pendente,
            patient_online=self._is_patient_online(c),
            duration_min=c.duracao_minutos,
            video_call_link=video_link,
            session_phase=self._session_phase(c),
            session_started_at=(
                sessao.cronometro_iniciado_em.isoformat()
                if sessao and getattr(sessao, "cronometro_iniciado_em", None)
                else None
            ),
        )

    def _to_block_row(self, note: str, *, bid: UUID, iso_date: date, all_day: bool, start_time, end_time) -> AgendaBlockResponse:
        return AgendaBlockResponse(
            id=bid,
            iso_date=iso_date.isoformat(),
            all_day=all_day,
            start_time=start_time.strftime("%H:%M") if start_time else None,
            end_time=end_time.strftime("%H:%M") if end_time else None,
            note=note,
        )

    def _join_window(self, c: Consulta) -> tuple[datetime, datetime]:
        starts_at = datetime.combine(c.data_agendada, c.hora_inicio, tzinfo=CLINIC_TZ)
        start = starts_at - timedelta(minutes=10)
        end = starts_at + timedelta(minutes=c.duracao_minutos)
        return start, end

    async def get_agenda(self, user: User, *, from_date: date) -> PsychologistAgendaResponse:
        n_closed = await self._clinical.auto_finish_live_sessions_past_duration()
        if n_closed:
            logger.info("Encerramento automático no backend: %d consulta(s) após fim do cronômetro.", n_closed)
        pid = await self._get_psicologo_id(user)
        consultations = await self._clinical.list_consultas_psicologo_desde(pid, from_date)
        blocks = await self._clinical.list_bloqueios_agenda_desde(pid, from_date)
        return PsychologistAgendaResponse(
            from_date=from_date,
            appointments=[self._to_appointment_row(c) for c in consultations],
            blocks=[
                self._to_block_row(
                    b.motivo,
                    bid=b.id,
                    iso_date=b.data_bloqueio,
                    all_day=b.dia_inteiro,
                    start_time=b.hora_inicio,
                    end_time=b.hora_fim,
                )
                for b in blocks
            ],
        )

    async def join_room(self, user: User, appointment_id: UUID) -> PsychologistAppointmentOnlineResponse:
        await self._clinical.auto_finish_live_sessions_past_duration()
        c = await self._get_owned_appointment(user, appointment_id)
        if c.situacao_pagamento != ConsultaSituacaoPagamento.pago:
            raise ConflictError("A sala só fica disponível para consultas com pagamento confirmado.")
        if c.status not in (ConsultaStatus.confirmada, ConsultaStatus.em_andamento):
            raise ConflictError("Somente consultas confirmadas permitem entrada na sala.")
        now = datetime.now(CLINIC_TZ)
        join_from, join_until = self._join_window(c)
        if now < join_from or now > join_until:
            raise ForbiddenError("A sala só pode ser acessada no horário permitido da consulta.")

        if c.status == ConsultaStatus.confirmada:
            c.status = ConsultaStatus.em_andamento
        if not c.link_videochamada_opcional:
            c.link_videochamada_opcional = f"https://meet.exemplo.com/{c.id}"
        await self._clinical.upsert_sessao_live(
            c,
            started_at=now,
            meet_url=c.link_videochamada_opcional,
        )
        saved = await self._clinical.save_consulta(c)
        self._publish_business_event(
            event_type="appointment.room.joined.psychologist",
            actor=str(user.id),
            resource_id=str(saved.id),
            data={"status": saved.status.value},
        )
        return PsychologistAppointmentOnlineResponse(
            appointment=self._to_appointment_row(saved),
            join_url=saved.link_videochamada_opcional,
            notes=saved.observacoes or "",
        )

    async def patch_notes(
        self,
        user: User,
        appointment_id: UUID,
        payload: PsychologistAppointmentNotesPatchRequest,
    ) -> PsychologistAppointmentOnlineResponse:
        c = await self._get_owned_appointment(user, appointment_id)
        c.observacoes = payload.notes.strip()
        saved = await self._clinical.save_consulta(c)
        self._publish_business_event(
            event_type="appointment.notes.updated",
            actor=str(user.id),
            resource_id=str(saved.id),
            data={"notes_length": len(saved.observacoes or "")},
        )
        return PsychologistAppointmentOnlineResponse(
            appointment=self._to_appointment_row(saved),
            join_url=saved.link_videochamada_opcional,
            notes=saved.observacoes or "",
        )

    async def patch_meeting_link(
        self,
        user: User,
        appointment_id: UUID,
        payload: PsychologistAppointmentMeetingLinkPatchRequest,
    ) -> PsychologistAppointmentOnlineResponse:
        c = await self._get_owned_appointment(user, appointment_id)
        join_url = payload.join_url.strip()
        c.link_videochamada_opcional = join_url
        sessao = getattr(c, "sessao_ao_vivo", None)
        if sessao is not None and sessao.encerrada_em is None:
            sessao.url_meet = join_url
        saved = await self._clinical.save_consulta(c)
        self._publish_business_event(
            event_type="appointment.meeting_link.updated",
            actor=str(user.id),
            resource_id=str(saved.id),
            data={"join_url": join_url},
        )
        return PsychologistAppointmentOnlineResponse(
            appointment=self._to_appointment_row(saved),
            join_url=join_url,
            notes=saved.observacoes or "",
        )

    async def finish_appointment(self, user: User, appointment_id: UUID) -> PsychologistAppointmentOnlineResponse:
        c = await self._get_owned_appointment(user, appointment_id)
        if c.status in (ConsultaStatus.realizada, ConsultaStatus.cancelada, ConsultaStatus.nao_compareceu):
            raise ConflictError("Consulta já encerrada e não pode ser finalizada novamente.")
        c.status = ConsultaStatus.realizada
        await self._clinical.mark_sessao_ended(c, ended_at=datetime.now(CLINIC_TZ))
        saved = await self._clinical.save_consulta(c)
        self._publish_business_event(
            event_type="appointment.finished",
            actor=str(user.id),
            resource_id=str(saved.id),
            data={"status": saved.status.value},
        )
        return PsychologistAppointmentOnlineResponse(
            appointment=self._to_appointment_row(saved),
            join_url=saved.link_videochamada_opcional,
            notes=saved.observacoes or "",
        )

    async def _get_owned_appointment(self, user: User, appointment_id: UUID) -> Consulta:
        self._ensure_psychologist(user)
        c = await self._clinical.get_consulta_com_cobranca_do_psicologo(appointment_id, user.id)
        if c is None:
            raise NotFoundError("Consulta não encontrada para este psicólogo.")
        return c

    def _publish_business_event(
        self,
        *,
        event_type: str,
        actor: str,
        resource_id: str,
        data: dict,
    ) -> None:
        try:
            self._audit.publish(
                event_type=event_type,
                actor=actor,
                resource_type="appointment",
                resource_id=resource_id,
                data=data,
            )
        except Exception:
            logger.exception("Evento de auditoria não publicado: %s", event_type)
