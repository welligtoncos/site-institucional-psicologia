"""Fluxo de agendamento pelo paciente com cobrança mock persistida no backend."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.clinical import Consulta, ConsultaModalidade, ConsultaSituacaoPagamento
from app.models.user import User, UserRole
from app.repositories.clinical_repository import ClinicalRepository
from app.schemas.patient_appointment_schema import (
    PatientAppointmentCreateRequest,
    PatientAppointmentCreateResponse,
    PatientAppointmentPaymentResponse,
    PatientAppointmentSummary,
    PatientChargeSummary,
)


class PatientAppointmentService:
    def __init__(self, db: AsyncSession) -> None:
        self._clinical = ClinicalRepository(db)

    def _ensure_patient(self, user: User) -> None:
        if user.role != UserRole.patient:
            raise ForbiddenError("Este recurso é exclusivo para usuários com perfil de paciente.")

    async def _get_or_create_paciente_id(self, user: User) -> UUID:
        self._ensure_patient(user)
        pac = await self._clinical.get_paciente_by_usuario_id(user.id)
        if pac is None:
            pac = await self._clinical.create_paciente(usuario_id=user.id, contato_emergencia=None)
        return pac.id

    def _appointment_summary(self, c: Consulta) -> PatientAppointmentSummary:
        ps_name = c.psicologo.usuario.name.strip() if c.psicologo and c.psicologo.usuario else "Profissional"
        patient_name = c.paciente.usuario.name.strip() if c.paciente and c.paciente.usuario else "Paciente"
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
            video_call_link=c.link_videochamada_opcional,
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
        return PatientAppointmentCreateResponse(
            appointment=self._appointment_summary(loaded),
            charge=self._charge_summary(loaded),
        )

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
        return PatientAppointmentPaymentResponse(
            appointment=self._appointment_summary(loaded),
            charge=self._charge_summary(loaded),
        )
