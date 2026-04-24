"""Catálogo de profissionais para o portal do paciente."""

from datetime import timedelta, time
import json
from pathlib import Path
from time import time as _agent_ts
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.booking_availability import (
    iter_dates,
    now_minutes_br,
    slots_for_calendar_day,
    today_br,
    weekday_js,
    weekday_label_pt,
)
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.user import User, UserRole
from app.repositories.clinical_repository import ClinicalRepository
from app.schemas.catalog_schema import (
    BookableDayItem,
    PsychologistBookableSlotsResponse,
    PsychologistCatalogItem,
    WeeklyTemplateItem,
    parse_especialidades_csv,
)


def _fmt_hhmm_time(t: time) -> str:
    return t.strftime("%H:%M")


# #region agent log
def _agent_log_catalog(hypothesis_id: str, location: str, message: str, data: dict) -> None:
    try:
        path = Path(__file__).resolve().parents[3] / "debug-6327f2.log"
        rec = {
            "sessionId": "6327f2",
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(_agent_ts() * 1000),
        }
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception:
        pass


# #endregion


class CatalogService:
    def __init__(self, db: AsyncSession) -> None:
        self._clinical = ClinicalRepository(db)

    async def list_psychologists_catalog(self, user: User, *, skip: int = 0, limit: int = 100) -> list[PsychologistCatalogItem]:
        if user.role != UserRole.patient:
            raise ForbiddenError("Apenas pacientes podem consultar o catálogo de profissionais.")
        rows = await self._clinical.list_psicologos_ativos_catalog(skip=skip, limit=limit)
        out: list[PsychologistCatalogItem] = []
        for ps in rows:
            u = ps.usuario
            nome = (u.name or "").strip() or "Profissional"
            out.append(
                PsychologistCatalogItem(
                    id=ps.id,
                    nome=nome,
                    crp=ps.crp,
                    bio=ps.bio or "",
                    valor_consulta=ps.valor_sessao_padrao,
                    duracao_minutos=ps.duracao_minutos_padrao,
                    foto_url=ps.foto_url,
                    especialidades=parse_especialidades_csv(ps.especialidades),
                )
            )
        return out

    async def get_psychologist_bookable_slots(
        self,
        user: User,
        psychologist_id: UUID,
        *,
        days: int = 7,
    ) -> PsychologistBookableSlotsResponse:
        if user.role != UserRole.patient:
            raise ForbiddenError("Apenas pacientes podem consultar horários para agendamento.")
        ps = await self._clinical.get_psicologo_ativo_by_id(psychologist_id)
        if ps is None:
            raise NotFoundError("Profissional não encontrado ou indisponível para agendamento.")

        weekly = await self._clinical.list_disponibilidade_semanal(psychologist_id)
        blocks = await self._clinical.list_bloqueios_agenda(psychologist_id)
        start = today_br()
        end = start + timedelta(days=days - 1)
        consultas = await self._clinical.list_consultas_psicologo_no_periodo(psychologist_id, start, end)

        duracao = int(ps.duracao_minutos_padrao or 50)
        t_br = today_br()
        nm = now_minutes_br()

        weekly_template = [
            WeeklyTemplateItem(
                weekday=int(r.dia_semana),
                weekday_label=weekday_label_pt(int(r.dia_semana)),
                ativo=bool(r.ativo),
                start=_fmt_hhmm_time(r.hora_inicio),
                end=_fmt_hhmm_time(r.hora_fim),
            )
            for r in sorted(weekly, key=lambda row: (int(row.dia_semana), row.hora_inicio))
        ]

        day_items: list[BookableDayItem] = []
        for d in iter_dates(start, days):
            slots = slots_for_calendar_day(
                d,
                today_br=t_br,
                now_minutes_br=nm,
                weekly=weekly,
                blocks=blocks,
                consultas=consultas,
                duracao_minutos=duracao,
            )
            wd = int(weekday_js(d))
            day_items.append(
                BookableDayItem(
                    date=d.isoformat(),
                    weekday=wd,
                    weekday_label=weekday_label_pt(wd),
                    slots=slots,
                )
            )

        u = ps.usuario
        nome = (u.name or "").strip() or "Profissional"
        # #region agent log
        total_slot_labels = sum(len(d.slots) for d in day_items)
        _agent_log_catalog(
            "H2-H4",
            "catalog_service.py:get_psychologist_bookable_slots",
            "bookable-slots aggregate",
            {
                "psychologist_id": str(psychologist_id),
                "days_param": days,
                "duracao_minutos": duracao,
                "weekly_rows_db": len(weekly),
                "weekly_ativo_true": sum(1 for r in weekly if bool(r.ativo)),
                "slots_total_all_days": total_slot_labels,
                "template_by_weekday": [
                    {"wd": int(r.dia_semana), "ativo": bool(r.ativo), "hi": _fmt_hhmm_time(r.hora_inicio), "hf": _fmt_hhmm_time(r.hora_fim)}
                    for r in sorted(weekly, key=lambda row: (int(row.dia_semana), row.hora_inicio))
                ],
            },
        )
        # #endregion
        return PsychologistBookableSlotsResponse(
            id=ps.id,
            nome=nome,
            crp=ps.crp,
            valor_consulta=ps.valor_sessao_padrao,
            duracao_minutos=duracao,
            especialidades=parse_especialidades_csv(ps.especialidades),
            weekly_template=weekly_template,
            days=day_items,
        )
