"""
Catálogo de profissionais ativos — JWT do paciente.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.catalog_schema import PsychologistBookableSlotsResponse, PsychologistCatalogItem
from app.services.catalog_service import CatalogService

router = APIRouter(
    prefix="/catalog",
    tags=["catalog"],
    responses={
        200: {"description": "OK"},
        403: {"description": "Papel não autorizado"},
        404: {"description": "Profissional não encontrado"},
    },
)


async def get_catalog_service(db: AsyncSession = Depends(get_db)) -> CatalogService:
    return CatalogService(db)


@router.get(
    "/psychologists",
    response_model=list[PsychologistCatalogItem],
    summary="Profissionais ativos (catálogo)",
    description="Requer JWT com papel `patient`. Lista psicólogos com usuário ativo: nome, CRP, bio, valor, foto e especialidades.",
)
async def list_psychologists_catalog(
    current_user: User = Depends(get_current_user),
    svc: CatalogService = Depends(get_catalog_service),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[PsychologistCatalogItem]:
    return await svc.list_psychologists_catalog(current_user, skip=skip, limit=limit)


@router.get(
    "/psychologists/{psychologist_id}/bookable-slots",
    response_model=PsychologistBookableSlotsResponse,
    summary="Horários livres para agendar",
    description="Requer JWT `patient`. Considera disponibilidade semanal, bloqueios e consultas já marcadas (timezone America/Sao_Paulo).",
)
async def psychologist_bookable_slots(
    psychologist_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: CatalogService = Depends(get_catalog_service),
    days: int = Query(7, ge=1, le=60),
) -> PsychologistBookableSlotsResponse:
    return await svc.get_psychologist_bookable_slots(current_user, psychologist_id, days=days)
