"""Fluxo de agendamento e atendimento online pelo paciente."""

from datetime import date, datetime, timedelta
import logging
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.messaging.business_event_publisher import BusinessEventPublisher
from app.models.clinical import (
    Consulta,
    ConsultaModalidade,
    ConsultaSituacaoPagamento,
    ConsultaStatus,
    SessaoAoVivoFase,
)
from app.models.user import User, UserRole
from app.repositories.clinical_repository import ClinicalRepository
from app.schemas.patient_appointment_schema import (
    AppointmentJoinRoomResponse,
    AppointmentLeaveRoomResponse,
    PatientAppointmentCreateRequest,
    PatientAppointmentCreateResponse,
    PatientAppointmentListResponse,
    PatientAppointmentPaymentResponse,
    PatientAppointmentSummary,
    PatientChargeSummary,
)


logger = logging.getLogger(__name__)
CLINIC_TZ = ZoneInfo("America/Sao_Paulo")


class PatientAppointmentService:
    def __init__(self, db: AsyncSession) -> None:
        self._clinical = ClinicalRepository(db)
        self._audit = BusinessEventPublisher()

    def _ensure_patient(self, user: User) -> None:
        if user.role != UserRole.patient:
            raise ForbiddenError("Este recurso é exclusivo para usuários com perfil de paciente.")

    async def _get_or_create_paciente_id(self, user: User) -> UUID:
        self._ensure_patient(user)
        pac = await self._clinical.get_paciente_by_usuario_id(user.id)
        if pac is None:
            pac = await self._clinical.create_paciente(usuario_id=user.id, contato_emergencia=None)
        return pac.id

    def _is_psychologist_online(self, c: Consulta) -> bool:
        sessao = getattr(c, "sessao_ao_vivo", None)
        if sessao is None:
            return False
        return sessao.fase == SessaoAoVivoFase.live and sessao.encerrada_em is None

    def _appointment_summary(self, c: Consulta) -> PatientAppointmentSummary:
        ps_name = c.psicologo.usuario.name.strip() if c.psicologo and c.psicologo.usuario else "Profissional"
        patient_name = c.paciente.usuario.name.strip() if c.paciente and c.paciente.usuario else "Paciente"
        sessao = getattr(c, "sessao_ao_vivo", None)
        video_link = c.link_videochamada_opcional
        if sessao is not None and getattr(sessao, "url_meet", None):
            video_link = sessao.url_meet
        return PatientAppointmentSummary(
            id=c.id,
            psychologist_id=c.psicologo_id,
            psychologist_name=ps_name,
            psychologist_crp=c.psicologo.crp if c.psicologo else "",
            patient_name=patient_name,
            specialty=c.especialidade_atendida,
            iso_date=c.data_agendada.isoformat(),
            time=c.hora_inicio.strftime("%H:%M"),
            format=c.modalidade.value,
            price=c.valor_acordado,
            duration_min=c.duracao_minutos,
            payment="Pago" if c.situacao_pagamento == ConsultaSituacaoPagamento.pago else "Pendente",
            status=c.status.value,
            video_call_link=video_link,
            psychologist_online=self._is_psychologist_online(c),
            session_phase=sessao.fase.value if sessao and getattr(sessao, "fase", None) else None,
            session_started_at=(
                sessao.cronometro_iniciado_em.isoformat()
                if sessao and getattr(sessao, "cronometro_iniciado_em", None)
                else None
            ),
        )

    def _charge_summary(self, c: Consulta) -> PatientChargeSummary:
        chg = c.cobranca
        if chg is None:
            raise NotFoundError("Cobrança não encontrada para esta consulta.")
        return PatientChargeSummary(
            id=chg.id,
            appointment_id=chg.consulta_id,
            amount_cents=chg.valor_centavos,
            currency=chg.moeda,
            gateway_provider=chg.provedor_gateway,
            gateway_intent_id=chg.id_intent_gateway,
            gateway_status=chg.status_gateway.value,
            created_at=chg.criado_em.isoformat(),
            paid_at=chg.pago_em.isoformat() if chg.pago_em else None,
        )

    def _join_window(self, c: Consulta) -> tuple[datetime, datetime]:
        starts_at = datetime.combine(c.data_agendada, c.hora_inicio, tzinfo=CLINIC_TZ)
        start = starts_at - timedelta(minutes=10)
        end = starts_at + timedelta(minutes=c.duracao_minutos + 15)
        return start, end

    async def create_appointment(
        self,
        user: User,
        payload: PatientAppointmentCreateRequest,
    ) -> PatientAppointmentCreateResponse:
        paciente_id = await self._get_or_create_paciente_id(user)
        ps = await self._clinical.get_psicologo_ativo_by_id(payload.psychologist_id)
        if ps is None:
            raise NotFoundError("Profissional não encontrado ou indisponível para agendamento.")

        # O enum do PostgreSQL usa valores "Online"/"Presencial" (case-sensitive).
        # Enviamos o literal exatamente nesse formato para evitar erro de enum inválido.
        modalidade = "Online" if payload.format.strip() == "Online" else "Presencial"
        hora_inicio = datetime.strptime(payload.time, "%H:%M").time()
        especialidade = ""
        if ps.especialidades:
            especialidade = ps.especialidades.split(",")[0].strip()
        if not especialidade:
            especialidade = "Consulta"

        consulta, _cobranca = await self._clinical.create_consulta_com_cobranca(
            paciente_id=paciente_id,
            psicologo_id=ps.id,
            data_agendada=payload.iso_date,
            hora_inicio=hora_inicio,
            duracao_minutos=int(ps.duracao_minutos_padrao or 50),
            modalidade=modalidade,
            valor_acordado=ps.valor_sessao_padrao,
            especialidade_atendida=especialidade,
            id_intent_gateway=f"pi_mock_{uuid4().hex[:8]}",
        )
        loaded = await self._clinical.get_consulta_com_cobranca_do_paciente(consulta.id, user.id)
        if loaded is None:
            raise NotFoundError("Consulta criada, mas não foi possível carregá-la.")
        response = PatientAppointmentCreateResponse(
            appointment=self._appointment_summary(loaded),
            charge=self._charge_summary(loaded),
        )
        self._publish_business_event(
            event_type="appointment.created",
            actor=str(user.id),
            resource_id=str(response.appointment.id),
            data={
                "psychologist_id": str(response.appointment.psychologist_id),
                "iso_date": response.appointment.iso_date,
                "time": response.appointment.time,
                "status": response.appointment.status,
                "payment": response.appointment.payment,
                "charge_id": str(response.charge.id),
                "gateway_status": response.charge.gateway_status,
            },
        )
        return response

    async def leave_room(self, user: User, appointment_id: UUID) -> AppointmentLeaveRoomResponse:
        self._ensure_patient(user)
        c = await self._clinical.get_consulta_com_cobranca_do_paciente(appointment_id, user.id)
        if c is None:
            raise NotFoundError("Consulta não encontrada para este paciente.")
        sessao = getattr(c, "sessao_ao_vivo", None)
        if sessao is None or sessao.encerrada_em is not None or sessao.fase != SessaoAoVivoFase.patient_waiting:
            raise ConflictError("Paciente não está na sala de espera para esta consulta.")
        await self._clinical.mark_sessao_ended(c, ended_at=datetime.now(CLINIC_TZ))
        saved = await self._clinical.save_consulta(c)
        response = AppointmentLeaveRoomResponse(
            appointment=self._appointment_summary(saved),
            left_now=True,
        )
        self._publish_business_event(
            event_type="appointment.room.left.patient",
            actor=str(user.id),
            resource_id=str(saved.id),
            data={"status": response.appointment.status},
        )
        return response

    async def simulate_payment_success(self, user: User, appointment_id: UUID) -> PatientAppointmentPaymentResponse:
        self._ensure_patient(user)
        c = await self._clinical.get_consulta_com_cobranca_do_paciente(appointment_id, user.id)
        if c is None:
            raise NotFoundError("Consulta não encontrada para este paciente.")
        link = f"https://meet.exemplo.com/{c.id}"
        updated, _chg = await self._clinical.mark_payment_success_for_consulta(
            c.id,
            default_video_link=link,
        )
        loaded = await self._clinical.get_consulta_com_cobranca_do_paciente(updated.id, user.id)
        if loaded is None:
            raise NotFoundError("Consulta paga, mas não foi possível carregá-la.")
        response = PatientAppointmentPaymentResponse(
            appointment=self._appointment_summary(loaded),
            charge=self._charge_summary(loaded),
        )
        self._publish_business_event(
            event_type="appointment.payment.simulated_success",
            actor=str(user.id),
            resource_id=str(response.appointment.id),
            data={
                "status": response.appointment.status,
                "payment": response.appointment.payment,
                "charge_id": str(response.charge.id),
                "gateway_status": response.charge.gateway_status,
            },
        )
        self._publish_business_event(
            event_type="appointment.confirmed",
            actor=str(user.id),
            resource_id=str(response.appointment.id),
            data={
                "status": response.appointment.status,
                "payment": response.appointment.payment,
                "video_call_link": response.appointment.video_call_link,
            },
        )
        return response

    async def list_my_appointments(
        self,
        user: User,
        *,
        from_date: date,
    ) -> PatientAppointmentListResponse:
        self._ensure_patient(user)
        rows = await self._clinical.list_consultas_com_cobranca_do_paciente_desde(user.id, from_date)
        return PatientAppointmentListResponse(
            appointments=[self._appointment_summary(c) for c in rows],
        )

    async def join_room(self, user: User, appointment_id: UUID) -> AppointmentJoinRoomResponse:
        self._ensure_patient(user)
        c = await self._clinical.get_consulta_com_cobranca_do_paciente(appointment_id, user.id)
        if c is None:
            raise NotFoundError("Consulta não encontrada para este paciente.")
        if c.status not in (ConsultaStatus.confirmada, ConsultaStatus.em_andamento):
            raise ConflictError("Somente consultas confirmadas permitem entrada na sala.")

        now = datetime.now(CLINIC_TZ)
        join_from, join_until = self._join_window(c)
        if now < join_from or now > join_until:
            raise ForbiddenError("A sala só pode ser acessada no horário permitido da consulta.")

        started_now = False
        if not c.link_videochamada_opcional:
            c.link_videochamada_opcional = f"https://meet.exemplo.com/{c.id}"
        await self._clinical.upsert_sessao_patient_waiting(
            c,
            joined_at=now,
            meet_url=c.link_videochamada_opcional,
        )
        saved = await self._clinical.save_consulta(c)
        response = AppointmentJoinRoomResponse(
            appointment=self._appointment_summary(saved),
            join_url=saved.link_videochamada_opcional or "",
            started_now=started_now,
        )
        self._publish_business_event(
            event_type="appointment.room.joined.patient",
            actor=str(user.id),
            resource_id=str(saved.id),
            data={
                "status": response.appointment.status,
                "started_now": started_now,
            },
        )
        return response

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
            # Não interrompe o fluxo de negócio se a auditoria assíncrona falhar.
            logger.exception("Evento de auditoria não publicado: %s", event_type)
