"""
Perfis clínicos autenticados (JWT) — separado dos endpoints públicos de cadastro em `/auth`.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.profile_schema import (
    PatientMeResponse,
    PatientProfilePatchRequest,
    PsychologistMeResponse,
    PsychologistProfilePatchRequest,
)
from app.services.profile_service import ProfileService

router = APIRouter(
    prefix="/profiles",
    tags=["profiles"],
    responses={
        200: {"description": "OK"},
        403: {"description": "Papel não autorizado para o recurso"},
        404: {"description": "Perfil não encontrado"},
        422: {"description": "Erro de validação"},
    },
)


async def get_profile_service(db: AsyncSession = Depends(get_db)) -> ProfileService:
    return ProfileService(db)


@router.get(
    "/patient/me",
    response_model=PatientMeResponse,
    summary="Meu perfil de paciente",
    description="Requer JWT com papel `patient`. Retorna usuário + linha em `pacientes`.",
)
async def patient_me(
    current_user: User = Depends(get_current_user),
    svc: ProfileService = Depends(get_profile_service),
) -> PatientMeResponse:
    return await svc.get_patient_me(current_user)


@router.patch(
    "/patient/me",
    response_model=PatientMeResponse,
    summary="Atualizar perfil de paciente",
    description="Requer JWT `patient`. Obrigatórios: nome, telefone e CPF; demais campos opcionais. Cria o perfil clínico na primeira vez.",
)
async def patient_me_patch(
    payload: PatientProfilePatchRequest,
    current_user: User = Depends(get_current_user),
    svc: ProfileService = Depends(get_profile_service),
) -> PatientMeResponse:
    return await svc.patch_patient_me(current_user, payload)


@router.get(
    "/psychologist/me",
    response_model=PsychologistMeResponse,
    summary="Meu perfil de psicólogo",
    description="Requer JWT com papel `psychologist`. Retorna usuário + linha em `psicologos`.",
)
async def psychologist_me(
    current_user: User = Depends(get_current_user),
    svc: ProfileService = Depends(get_profile_service),
) -> PsychologistMeResponse:
    return await svc.get_psychologist_me(current_user)


@router.patch(
    "/psychologist/me",
    response_model=PsychologistMeResponse,
    summary="Atualizar perfil de psicólogo",
    description="Requer JWT `psychologist`. Campos opcionais: name, phone, crp, bio, foto_url, especialidades (CSV), valor_sessao_padrao, duracao_minutos_padrao.",
    status_code=status.HTTP_200_OK,
)
async def psychologist_me_patch(
    payload: PsychologistProfilePatchRequest,
    current_user: User = Depends(get_current_user),
    svc: ProfileService = Depends(get_profile_service),
) -> PsychologistMeResponse:
    return await svc.patch_psychologist_me(current_user, payload)
