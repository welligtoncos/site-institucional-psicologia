"""
Portal administrativo (rotas em português) — JWT com papel `admin`.

Complementa `admin_clinical.py` (listagens legadas em inglês).
"""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_admin_user
from app.core.database import get_db
from app.models.clinical import CobrancaStatusGateway, ConsultaStatus
from app.models.user import User
from app.schemas.admin_schema import (
    AdminConsultaCancelarRequest,
    AdminConsultaCancelarResponse,
    AdminConsultaDetailResponse,
    AdminConsultaListResponse,
    AdminConsultaRemarcarRequest,
    AdminConsultaRemarcarResponse,
    AdminDashboardIndicadoresResponse,
    AdminPacienteHistoricoResponse,
    AdminPagamentoDetailResponse,
    AdminPagamentoListResponse,
    AdminPatientPutRequest,
    AdminPsychologistPutRequest,
    AdminPsychologistStatusPatchRequest,
)
from app.schemas.auth_schema import PsychologistRegisterRequest
from app.schemas.profile_schema import (
    PatientListResponse,
    PatientMeResponse,
    PsychologistListResponse,
    PsychologistMeResponse,
)
from app.services.admin_portal_service import AdminPortalService
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


async def get_admin_portal_service(db: AsyncSession = Depends(get_db)) -> AdminPortalService:
    return AdminPortalService(db)


def _parse_consulta_status(raw: str | None) -> ConsultaStatus | None:
    if raw is None or not raw.strip():
        return None
    try:
        return ConsultaStatus(raw.strip())
    except ValueError:
        return None


def _parse_gateway_status(raw: str | None) -> CobrancaStatusGateway | None:
    if raw is None or not raw.strip():
        return None
    try:
        return CobrancaStatusGateway(raw.strip())
    except ValueError:
        return None


@router.get(
    "/dashboard/indicadores",
    response_model=AdminDashboardIndicadoresResponse,
    summary="Indicadores do dashboard administrativo",
)
async def dashboard_indicadores(
    _: User = Depends(get_current_admin_user),
    svc: AdminPortalService = Depends(get_admin_portal_service),
) -> AdminDashboardIndicadoresResponse:
    return await svc.get_indicadores()


@router.get(
    "/pacientes",
    response_model=PatientListResponse,
    summary="Listar pacientes",
)
async def list_pacientes_pt(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _: User = Depends(get_current_admin_user),
    svc: ClinicalDirectoryService = Depends(get_clinical_directory_service),
) -> PatientListResponse:
    return await svc.list_patients(skip=skip, limit=limit)


@router.get(
    "/pacientes/{paciente_id}",
    response_model=AdminPacienteHistoricoResponse,
    summary="Detalhe do paciente com histórico",
)
async def get_paciente_detalhe(
    paciente_id: UUID,
    _: User = Depends(get_current_admin_user),
    svc: AdminPortalService = Depends(get_admin_portal_service),
) -> AdminPacienteHistoricoResponse:
    return await svc.get_paciente_detalhe(paciente_id)


@router.put(
    "/pacientes/{paciente_id}",
    response_model=PatientMeResponse,
    summary="Atualizar paciente",
)
async def put_paciente(
    paciente_id: UUID,
    payload: AdminPatientPutRequest,
    _: User = Depends(get_current_admin_user),
    svc: AdminPortalService = Depends(get_admin_portal_service),
) -> PatientMeResponse:
    return await svc.update_paciente(paciente_id, payload)


@router.get(
    "/psicologos",
    response_model=PsychologistListResponse,
    summary="Listar psicólogos",
)
async def list_psicologos_pt(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _: User = Depends(get_current_admin_user),
    svc: ClinicalDirectoryService = Depends(get_clinical_directory_service),
) -> PsychologistListResponse:
    return await svc.list_psychologists(skip=skip, limit=limit)


@router.post(
    "/psicologos",
    response_model=PsychologistMeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar psicólogo",
)
async def post_psicologo(
    payload: PsychologistRegisterRequest,
    _: User = Depends(get_current_admin_user),
    svc: AdminPortalService = Depends(get_admin_portal_service),
) -> PsychologistMeResponse:
    return await svc.create_psicologo(payload)


@router.get(
    "/psicologos/{psicologo_id}",
    response_model=PsychologistMeResponse,
    summary="Detalhe do psicólogo",
)
async def get_psicologo_pt(
    psicologo_id: UUID,
    _: User = Depends(get_current_admin_user),
    svc: AdminPortalService = Depends(get_admin_portal_service),
) -> PsychologistMeResponse:
    return await svc.get_psicologo(psicologo_id)


@router.put(
    "/psicologos/{psicologo_id}",
    response_model=PsychologistMeResponse,
    summary="Atualizar psicólogo",
)
async def put_psicologo(
    psicologo_id: UUID,
    payload: AdminPsychologistPutRequest,
    _: User = Depends(get_current_admin_user),
    svc: AdminPortalService = Depends(get_admin_portal_service),
) -> PsychologistMeResponse:
    return await svc.update_psicologo(psicologo_id, payload)


@router.patch(
    "/psicologos/{psicologo_id}/status",
    response_model=PsychologistMeResponse,
    summary="Ativar ou inativar psicólogo",
)
async def patch_psicologo_status(
    psicologo_id: UUID,
    payload: AdminPsychologistStatusPatchRequest,
    _: User = Depends(get_current_admin_user),
    svc: AdminPortalService = Depends(get_admin_portal_service),
) -> PsychologistMeResponse:
    return await svc.patch_psicologo_status(psicologo_id, payload)


@router.get(
    "/consultas",
    response_model=AdminConsultaListResponse,
    summary="Listar consultas",
)
async def list_consultas_pt(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    data_inicio: date | None = Query(None),
    data_fim: date | None = Query(None),
    paciente_id: UUID | None = Query(None),
    psicologo_id: UUID | None = Query(None),
    status: str | None = Query(None, description="Valor do enum: agendada, confirmada, ..."),
    _: User = Depends(get_current_admin_user),
    svc: AdminPortalService = Depends(get_admin_portal_service),
) -> AdminConsultaListResponse:
    st = _parse_consulta_status(status)
    return await svc.list_consultas(
        skip=skip,
        limit=limit,
        data_inicio=data_inicio,
        data_fim=data_fim,
        paciente_id=paciente_id,
        psicologo_id=psicologo_id,
        status=st,
    )


@router.get(
    "/consultas/{consulta_id}",
    response_model=AdminConsultaDetailResponse,
    summary="Detalhe da consulta",
)
async def get_consulta_pt(
    consulta_id: UUID,
    _: User = Depends(get_current_admin_user),
    svc: AdminPortalService = Depends(get_admin_portal_service),
) -> AdminConsultaDetailResponse:
    return await svc.get_consulta(consulta_id)


@router.patch(
    "/consultas/{consulta_id}/cancelar",
    response_model=AdminConsultaCancelarResponse,
    summary="Cancelar consulta",
)
async def patch_cancelar_consulta(
    consulta_id: UUID,
    payload: AdminConsultaCancelarRequest | None = None,
    _: User = Depends(get_current_admin_user),
    svc: AdminPortalService = Depends(get_admin_portal_service),
) -> AdminConsultaCancelarResponse:
    body = payload or AdminConsultaCancelarRequest()
    return await svc.cancelar_consulta(consulta_id, body)


@router.patch(
    "/consultas/{consulta_id}/remarcar",
    response_model=AdminConsultaRemarcarResponse,
    summary="Remarcar consulta",
)
async def patch_remarcar_consulta(
    consulta_id: UUID,
    payload: AdminConsultaRemarcarRequest,
    _: User = Depends(get_current_admin_user),
    svc: AdminPortalService = Depends(get_admin_portal_service),
) -> AdminConsultaRemarcarResponse:
    return await svc.remarcar_consulta(consulta_id, payload)


@router.get(
    "/pagamentos",
    response_model=AdminPagamentoListResponse,
    summary="Listar cobranças / pagamentos",
)
async def list_pagamentos_pt(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: str | None = Query(None, description="awaiting_payment, succeeded, failed"),
    data_inicio: date | None = Query(None),
    data_fim: date | None = Query(None),
    paciente_id: UUID | None = Query(None),
    forma_pagamento: str | None = Query(None, description="Filtra por provedor_gateway exato (ex.: mercadopago)"),
    _: User = Depends(get_current_admin_user),
    svc: AdminPortalService = Depends(get_admin_portal_service),
) -> AdminPagamentoListResponse:
    gst = _parse_gateway_status(status)
    return await svc.list_pagamentos(
        skip=skip,
        limit=limit,
        status_gateway=gst,
        data_inicio=data_inicio,
        data_fim=data_fim,
        paciente_id=paciente_id,
        provedor=forma_pagamento,
    )


@router.get(
    "/pagamentos/{cobranca_id}",
    response_model=AdminPagamentoDetailResponse,
    summary="Detalhe da cobrança",
)
async def get_pagamento_pt(
    cobranca_id: UUID,
    _: User = Depends(get_current_admin_user),
    svc: AdminPortalService = Depends(get_admin_portal_service),
) -> AdminPagamentoDetailResponse:
    return await svc.get_pagamento(cobranca_id)
