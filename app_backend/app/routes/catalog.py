"""
Catálogo de profissionais ativos — JWT do paciente.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.catalog_schema import PsychologistCatalogItem
from app.services.catalog_service import CatalogService

router = APIRouter(
    prefix="/catalog",
    tags=["catalog"],
    responses={
        200: {"description": "OK"},
        403: {"description": "Papel não autorizado"},
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
