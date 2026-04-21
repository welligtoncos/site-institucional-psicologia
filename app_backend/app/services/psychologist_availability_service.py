"""Leitura e substituição da disponibilidade semanal e bloqueios (perfil psicólogo)."""

from datetime import date, datetime, time
import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.messaging.business_event_publisher import BusinessEventPublisher
from app.models.clinical import BloqueioAgenda, DisponibilidadeSemanal
from app.models.user import User, UserRole
from app.repositories.clinical_repository import ClinicalRepository
from app.schemas.availability_schema import (
    AgendaBlockResponse,
    PsychologistAvailabilityPutRequest,
    PsychologistAvailabilityResponse,
    WeeklySlotResponse,
)


logger = logging.getLogger(__name__)


def _fmt_hhmm(t: time) -> str:
    return t.strftime("%H:%M")


class PsychologistAvailabilityService:
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

    def _weekly_to_response(self, rows: list[DisponibilidadeSemanal]) -> list[WeeklySlotResponse]:
        return [
            WeeklySlotResponse(
                id=r.id,
                weekday=r.dia_semana,
                enabled=r.ativo,
                start=_fmt_hhmm(r.hora_inicio),
                end=_fmt_hhmm(r.hora_fim),
            )
            for r in rows
        ]

    def _blocks_to_response(self, rows: list[BloqueioAgenda]) -> list[AgendaBlockResponse]:
        out: list[AgendaBlockResponse] = []
        for r in rows:
            st = None if r.hora_inicio is None else _fmt_hhmm(r.hora_inicio)
            et = None if r.hora_fim is None else _fmt_hhmm(r.hora_fim)
            out.append(
                AgendaBlockResponse(
                    id=r.id,
                    iso_date=r.data_bloqueio.isoformat(),
                    all_day=r.dia_inteiro,
                    start_time=st,
                    end_time=et,
                    note=r.motivo,
                )
            )
        return out

    async def get_availability(self, user: User) -> PsychologistAvailabilityResponse:
        pid = await self._get_psicologo_id(user)
        weekly = await self._clinical.list_disponibilidade_semanal(pid)
        blocks = await self._clinical.list_bloqueios_agenda(pid)
        return PsychologistAvailabilityResponse(
            weekly=self._weekly_to_response(weekly),
            blocks=self._blocks_to_response(blocks),
        )

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
                resource_type="availability",
                resource_id=resource_id,
                data=data,
            )
        except Exception:
            logger.exception("Evento de auditoria não publicado: %s", event_type)

    async def put_availability(self, user: User, payload: PsychologistAvailabilityPutRequest) -> PsychologistAvailabilityResponse:
        pid = await self._get_psicologo_id(user)

        slots: list[tuple[int, bool, time, time]] = []
        for w in payload.weekly:
            hi = datetime.strptime(w.start, "%H:%M").time()
            hf = datetime.strptime(w.end, "%H:%M").time()
            slots.append((w.weekday, w.enabled, hi, hf))

        block_rows: list[tuple[date, bool, time | None, time | None, str]] = []
        for b in payload.blocks:
            if b.all_day:
                block_rows.append((b.iso_date, True, None, None, b.note))
            else:
                assert b.start_time is not None and b.end_time is not None
                hi = datetime.strptime(b.start_time, "%H:%M").time()
                hf = datetime.strptime(b.end_time, "%H:%M").time()
                block_rows.append((b.iso_date, False, hi, hf, b.note))

        await self._clinical.replace_disponibilidade_semanal(pid, slots=slots)
        await self._clinical.replace_bloqueios_agenda(pid, rows=block_rows)

        weekly = await self._clinical.list_disponibilidade_semanal(pid)
        blocks = await self._clinical.list_bloqueios_agenda(pid)
        response = PsychologistAvailabilityResponse(
            weekly=self._weekly_to_response(weekly),
            blocks=self._blocks_to_response(blocks),
        )
        self._publish_business_event(
            event_type="availability.updated",
            actor=str(user.id),
            resource_id=str(pid),
            data={
                "weekly_count": len(response.weekly),
                "blocks_count": len(response.blocks),
                "weekly": [slot.model_dump(mode="json") for slot in response.weekly],
                "blocks": [block.model_dump(mode="json") for block in response.blocks],
            },
        )
        return response
