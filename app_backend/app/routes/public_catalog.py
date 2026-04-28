"""
Catálogo e agenda para o site institucional — sem autenticação.

Os mesmos dados do portal do paciente (preços e horários livres), expostos para
páginas públicas como /equipe.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.core.database import get_db
from app.schemas.catalog_schema import PsychologistBookableSlotsResponse, PsychologistCatalogItem
from app.services.catalog_service import CatalogService

router = APIRouter(
    prefix="/public/catalog",
    tags=["public-catalog"],
    responses={
        200: {"description": "OK"},
        404: {"description": "Profissional não encontrado"},
    },
)


async def get_catalog_service(db: AsyncSession = Depends(get_db)) -> CatalogService:
    return CatalogService(db)


@router.get(
    "/psychologists",
    response_model=list[PsychologistCatalogItem],
    summary="Profissionais ativos (site público)",
    description="Lista psicólogos com usuário ativo — mesmo conteúdo do catálogo autenticado, sem JWT.",
)
async def list_psychologists_public(
    svc: CatalogService = Depends(get_catalog_service),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[PsychologistCatalogItem]:
    return await svc.list_psychologists_catalog_public(skip=skip, limit=limit)


@router.get(
    "/psychologists/{psychologist_id}/bookable-slots",
    response_model=PsychologistBookableSlotsResponse,
    summary="Horários livres (site público)",
    description="Grade de vagas nos próximos dias — mesmo critério do portal (America/Sao_Paulo).",
)
async def psychologist_bookable_slots_public(
    psychologist_id: UUID,
    svc: CatalogService = Depends(get_catalog_service),
    days: int = Query(14, ge=1, le=60),
) -> PsychologistBookableSlotsResponse:
    return await svc.get_psychologist_bookable_slots_public(psychologist_id, days=days)


@router.get(
    "/psychologists/{psychologist_id}/foto",
    summary="Foto do profissional (público)",
    description=(
        "Resolve `foto_url` do cadastro: data URL (bytes), redireciona http(s) ou caminho relativo à API. "
        "Uso típico: `<img src>` no site sem transportar base64 no JSON/RSC."
    ),
    responses={302: {"description": "Redirecionamento"}, 404: {"description": "Não encontrado"}},
)
async def psychologist_foto_public(
    psychologist_id: UUID,
    request: Request,
    svc: CatalogService = Depends(get_catalog_service),
):
    return await svc.psychologist_foto_http_response(psychologist_id, request)
