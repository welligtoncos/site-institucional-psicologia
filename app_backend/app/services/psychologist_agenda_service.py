"""Leitura da agenda do psicólogo (consultas + bloqueios futuros)."""

from datetime import date
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.clinical import Consulta, ConsultaSituacaoPagamento, ConsultaStatus
from app.models.user import User, UserRole
from app.repositories.clinical_repository import ClinicalRepository
from app.schemas.agenda_schema import (
    PsychologistAgendaAppointmentResponse,
    PsychologistAgendaResponse,
)
from app.schemas.availability_schema import AgendaBlockResponse


class PsychologistAgendaService:
    def __init__(self, db: AsyncSession) -> None:
        self._clinical = ClinicalRepository(db)

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
        if c.status in (ConsultaStatus.confirmada, ConsultaStatus.em_andamento):
            return "confirmada"
        if c.status == ConsultaStatus.cancelada:
            return "cancelada"
        return "realizada"

    def _to_appointment_row(self, c: Consulta) -> PsychologistAgendaAppointmentResponse:
        patient_name = c.paciente.usuario.name.strip() if c.paciente and c.paciente.usuario and c.paciente.usuario.name else "Paciente"
        return PsychologistAgendaAppointmentResponse(
            id=c.id,
            patient_id=c.paciente_id,
            patient_name=patient_name,
            iso_date=c.data_agendada.isoformat(),
            time=c.hora_inicio.strftime("%H:%M"),
            format=c.modalidade.value,
            status=self._agenda_status(c),
            payment_pending=c.situacao_pagamento == ConsultaSituacaoPagamento.pendente,
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

    async def get_agenda(self, user: User, *, from_date: date) -> PsychologistAgendaResponse:
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
