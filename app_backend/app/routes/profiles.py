"""
Perfis clínicos autenticados (JWT) — separado dos endpoints públicos de cadastro em `/auth`.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.availability_schema import (
    PsychologistAvailabilityPutRequest,
    PsychologistAvailabilityResponse,
)
from app.schemas.profile_schema import (
    PatientMeResponse,
    PatientProfilePatchRequest,
    PsychologistMeResponse,
    PsychologistProfilePatchRequest,
)
from app.services.profile_service import ProfileService
from app.services.psychologist_availability_service import PsychologistAvailabilityService

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


async def get_psychologist_availability_service(
    db: AsyncSession = Depends(get_db),
) -> PsychologistAvailabilityService:
    return PsychologistAvailabilityService(db)


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


@router.get(
    "/psychologist/me/availability",
    response_model=PsychologistAvailabilityResponse,
    summary="Disponibilidade semanal e bloqueios",
    description="Requer JWT `psychologist`. Lê intervalos em `disponibilidade_semanal` e bloqueios em `bloqueios_agenda`.",
)
async def psychologist_availability_get(
    current_user: User = Depends(get_current_user),
    svc: PsychologistAvailabilityService = Depends(get_psychologist_availability_service),
) -> PsychologistAvailabilityResponse:
    return await svc.get_availability(current_user)


@router.put(
    "/psychologist/me/availability",
    response_model=PsychologistAvailabilityResponse,
    summary="Substituir disponibilidade e bloqueios",
    description="Requer JWT `psychologist`. Substitui todos os intervalos semanais e todos os bloqueios do profissional.",
    status_code=status.HTTP_200_OK,
)
async def psychologist_availability_put(
    payload: PsychologistAvailabilityPutRequest,
    current_user: User = Depends(get_current_user),
    svc: PsychologistAvailabilityService = Depends(get_psychologist_availability_service),
) -> PsychologistAvailabilityResponse:
    return await svc.put_availability(current_user, payload)
