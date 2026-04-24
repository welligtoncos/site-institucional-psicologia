"""
Perfis clínicos autenticados (JWT) — separado dos endpoints públicos de cadastro em `/auth`.
"""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.agenda_schema import (
    PsychologistAppointmentMeetingLinkPatchRequest,
    PsychologistAppointmentNotesPatchRequest,
    PsychologistAppointmentOnlineResponse,
    PsychologistAgendaResponse,
)
from app.schemas.availability_schema import (
    PsychologistAvailabilityPutRequest,
    PsychologistAvailabilityResponse,
)
from app.schemas.mercado_pago_schema import MercadoPagoSyncReturnRequest, MercadoPagoSyncReturnResponse
from app.schemas.profile_schema import (
    PatientMeResponse,
    PatientProfilePatchRequest,
    PsychologistMeResponse,
    PsychologistProfilePatchRequest,
)
from app.schemas.patient_appointment_schema import (
    AppointmentJoinRoomResponse,
    AppointmentLeaveRoomResponse,
    PatientAppointmentCreateRequest,
    PatientAppointmentCreateResponse,
    PatientAppointmentListResponse,
    PatientAppointmentPaymentResponse,
)
from app.services.patient_appointment_service import PatientAppointmentService
from app.services.psychologist_agenda_service import PsychologistAgendaService
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


async def get_psychologist_agenda_service(
    db: AsyncSession = Depends(get_db),
) -> PsychologistAgendaService:
    return PsychologistAgendaService(db)


async def get_patient_appointment_service(
    db: AsyncSession = Depends(get_db),
) -> PatientAppointmentService:
    return PatientAppointmentService(db)


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


@router.get(
    "/psychologist/me/agenda",
    response_model=PsychologistAgendaResponse,
    summary="Agenda do psicólogo",
    description="Requer JWT `psychologist`. Lista consultas desde a data informada e bloqueios futuros.",
)
async def psychologist_agenda_get(
    from_date: date | None = Query(default=None, description="Data inicial (YYYY-MM-DD). Padrão: hoje."),
    current_user: User = Depends(get_current_user),
    svc: PsychologistAgendaService = Depends(get_psychologist_agenda_service),
) -> PsychologistAgendaResponse:
    return await svc.get_agenda(current_user, from_date=from_date or date.today())


@router.post(
    "/patient/me/appointments",
    response_model=PatientAppointmentCreateResponse,
    summary="Criar consulta do paciente",
    description="Requer JWT `patient`. Cria consulta + cobrança mock persistidas no backend.",
    status_code=status.HTTP_201_CREATED,
)
async def patient_appointment_create(
    payload: PatientAppointmentCreateRequest,
    current_user: User = Depends(get_current_user),
    svc: PatientAppointmentService = Depends(get_patient_appointment_service),
) -> PatientAppointmentCreateResponse:
    return await svc.create_appointment(current_user, payload)


@router.post(
    "/patient/me/appointments/{appointment_id}/simulate-payment",
    response_model=PatientAppointmentPaymentResponse,
    summary="Simular pagamento concluído",
    description="Requer JWT `patient`. Marca cobrança como paga e confirma a consulta.",
)
async def patient_appointment_simulate_payment(
    appointment_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: PatientAppointmentService = Depends(get_patient_appointment_service),
) -> PatientAppointmentPaymentResponse:
    return await svc.simulate_payment_success(current_user, appointment_id)


@router.post(
    "/patient/me/mercadopago/sync-return",
    response_model=MercadoPagoSyncReturnResponse,
    summary="Sincronizar pagamento após retorno do Mercado Pago",
    description=(
        "Requer JWT `patient`. Consulta o pagamento na API do Mercado Pago e atualiza cobrança/consulta se aprovado. "
        "Complementa webhooks (dev ou quando a notificação atrasar)."
    ),
)
async def patient_mercadopago_sync_return(
    body: MercadoPagoSyncReturnRequest,
    current_user: User = Depends(get_current_user),
    svc: PatientAppointmentService = Depends(get_patient_appointment_service),
) -> MercadoPagoSyncReturnResponse:
    return await svc.sync_mercadopago_payment_from_return(current_user, payment_id=body.payment_id)


@router.get(
    "/patient/me/appointments",
    response_model=PatientAppointmentListResponse,
    summary="Minhas consultas",
    description="Requer JWT `patient`. Lista consultas do paciente a partir de uma data.",
)
async def patient_appointments_list(
    from_date: date | None = Query(default=None, description="Data inicial (YYYY-MM-DD). Padrão: hoje."),
    current_user: User = Depends(get_current_user),
    svc: PatientAppointmentService = Depends(get_patient_appointment_service),
) -> PatientAppointmentListResponse:
    return await svc.list_my_appointments(current_user, from_date=from_date or date.today())


@router.post(
    "/patient/me/appointments/{appointment_id}/join-room",
    response_model=AppointmentJoinRoomResponse,
    summary="Entrar na sala (paciente)",
    description="Requer JWT `patient`. Permite entrada apenas para consulta confirmada no horário permitido.",
)
async def patient_appointment_join_room(
    appointment_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: PatientAppointmentService = Depends(get_patient_appointment_service),
) -> AppointmentJoinRoomResponse:
    return await svc.join_room(current_user, appointment_id)


@router.post(
    "/patient/me/appointments/{appointment_id}/leave-room",
    response_model=AppointmentLeaveRoomResponse,
    summary="Sair da sala de espera (paciente)",
    description="Requer JWT `patient`. Remove presença do paciente na sala de espera.",
)
async def patient_appointment_leave_room(
    appointment_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: PatientAppointmentService = Depends(get_patient_appointment_service),
) -> AppointmentLeaveRoomResponse:
    return await svc.leave_room(current_user, appointment_id)


@router.post(
    "/psychologist/me/appointments/{appointment_id}/join-room",
    response_model=PsychologistAppointmentOnlineResponse,
    summary="Entrar na sala (psicólogo)",
    description="Requer JWT `psychologist`. Permite entrada apenas para consulta confirmada no horário permitido.",
)
async def psychologist_appointment_join_room(
    appointment_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: PsychologistAgendaService = Depends(get_psychologist_agenda_service),
) -> PsychologistAppointmentOnlineResponse:
    return await svc.join_room(current_user, appointment_id)


@router.patch(
    "/psychologist/me/appointments/{appointment_id}/notes",
    response_model=PsychologistAppointmentOnlineResponse,
    summary="Registrar observações da sessão",
    description="Requer JWT `psychologist`. Atualiza observações internas da consulta.",
)
async def psychologist_appointment_patch_notes(
    appointment_id: UUID,
    payload: PsychologistAppointmentNotesPatchRequest,
    current_user: User = Depends(get_current_user),
    svc: PsychologistAgendaService = Depends(get_psychologist_agenda_service),
) -> PsychologistAppointmentOnlineResponse:
    return await svc.patch_notes(current_user, appointment_id, payload)


@router.patch(
    "/psychologist/me/appointments/{appointment_id}/meeting-link",
    response_model=PsychologistAppointmentOnlineResponse,
    summary="Salvar link da videochamada",
    description="Requer JWT `psychologist`. Publica/atualiza o link da sala para paciente e psicólogo.",
)
async def psychologist_appointment_patch_meeting_link(
    appointment_id: UUID,
    payload: PsychologistAppointmentMeetingLinkPatchRequest,
    current_user: User = Depends(get_current_user),
    svc: PsychologistAgendaService = Depends(get_psychologist_agenda_service),
) -> PsychologistAppointmentOnlineResponse:
    return await svc.patch_meeting_link(current_user, appointment_id, payload)


@router.post(
    "/psychologist/me/appointments/{appointment_id}/finish",
    response_model=PsychologistAppointmentOnlineResponse,
    summary="Finalizar consulta",
    description="Requer JWT `psychologist`. Encerra atendimento e marca consulta como realizada.",
)
async def psychologist_appointment_finish(
    appointment_id: UUID,
    current_user: User = Depends(get_current_user),
    svc: PsychologistAgendaService = Depends(get_psychologist_agenda_service),
) -> PsychologistAppointmentOnlineResponse:
    return await svc.finish_appointment(current_user, appointment_id)
