"""
Listagens de pacientes e psicólogos — **JWT com papel `admin`**.

Expõe dados de `users` + tabelas clínicas; não use em rotas públicas.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_admin_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.profile_schema import PatientListResponse, PsychologistListResponse
from app.services.clinical_directory_service import ClinicalDirectoryService

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    responses={
        401: {"description": "Não autenticado"},
        403: {"description": "Papel diferente de administrador"},
    },
)


async def get_clinical_directory_service(db: AsyncSession = Depends(get_db)) -> ClinicalDirectoryService:
    return ClinicalDirectoryService(db)


@router.get(
    "/patients",
    response_model=PatientListResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar pacientes",
    description="Retorna perfis em `pacientes` com dados do usuário. Requer JWT de administrador.",
)
async def list_patients(
    skip: int = Query(0, ge=0, description="Offset para paginação"),
    limit: int = Query(50, ge=1, le=200, description="Quantidade máxima por página"),
    _: User = Depends(get_current_admin_user),
    svc: ClinicalDirectoryService = Depends(get_clinical_directory_service),
) -> PatientListResponse:
    return await svc.list_patients(skip=skip, limit=limit)


@router.get(
    "/psychologists",
    response_model=PsychologistListResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar psicólogos",
    description="Retorna perfis em `psicologos` com dados do usuário. Requer JWT de administrador.",
)
async def list_psychologists(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _: User = Depends(get_current_admin_user),
    svc: ClinicalDirectoryService = Depends(get_clinical_directory_service),
) -> PsychologistListResponse:
    return await svc.list_psychologists(skip=skip, limit=limit)
