"""Leitura e atualização de perfis clínicos (requer JWT com papel adequado)."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.user import User, UserRole
from app.repositories.clinical_repository import ClinicalRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth_schema import UserResponse
from app.schemas.profile_schema import (
    PatientMeResponse,
    PatientProfilePatchRequest,
    PacienteProfileResponse,
    PsychologistMeResponse,
    PsychologistProfilePatchRequest,
    PsicologoProfileResponse,
)


class ProfileService:
    def __init__(self, db: AsyncSession) -> None:
        self._clinical = ClinicalRepository(db)
        self._users = UserRepository(db)

    async def get_patient_me(self, user: User) -> PatientMeResponse:
        if user.role != UserRole.patient:
            raise ForbiddenError("Este recurso é exclusivo para usuários com perfil de paciente.")
        paciente = await self._clinical.get_paciente_by_usuario_id(user.id)
        if paciente is None:
            paciente = await self._clinical.create_paciente(usuario_id=user.id, contato_emergencia=None)
        return PatientMeResponse(
            user=UserResponse.model_validate(user),
            paciente=PacienteProfileResponse.model_validate(paciente),
        )

    async def patch_patient_me(self, user: User, data: PatientProfilePatchRequest) -> PatientMeResponse:
        if user.role != UserRole.patient:
            raise ForbiddenError("Este recurso é exclusivo para usuários com perfil de paciente.")
        raw = data.model_dump()
        user_updated = await self._users.update_name_phone(user.id, name=raw["name"], phone=raw["phone"])
        paciente_updates = {k: raw[k] for k in ClinicalRepository._PACIENTE_UPDATE_FIELDS}
        paciente = await self._clinical.upsert_paciente_perfil(user.id, paciente_updates)
        return PatientMeResponse(
            user=UserResponse.model_validate(user_updated),
            paciente=PacienteProfileResponse.model_validate(paciente),
        )

    async def get_psychologist_me(self, user: User) -> PsychologistMeResponse:
        if user.role != UserRole.psychologist:
            raise ForbiddenError("Este recurso é exclusivo para usuários com perfil de psicólogo.")
        ps = await self._clinical.get_psicologo_by_usuario_id(user.id)
        if ps is None:
            raise NotFoundError("Perfil de psicólogo não encontrado. Conclua o cadastro ou contate o suporte.")
        return PsychologistMeResponse(
            user=UserResponse.model_validate(user),
            psicologo=PsicologoProfileResponse.model_validate(ps),
        )

    async def patch_psychologist_me(
        self, user: User, data: PsychologistProfilePatchRequest
    ) -> PsychologistMeResponse:
        if user.role != UserRole.psychologist:
            raise ForbiddenError("Este recurso é exclusivo para usuários com perfil de psicólogo.")
        ps = await self._clinical.update_psicologo_perfil(
            user.id,
            bio=data.bio,
            valor_sessao_padrao=data.valor_sessao_padrao,
            duracao_minutos_padrao=data.duracao_minutos_padrao,
        )
        return PsychologistMeResponse(
            user=UserResponse.model_validate(user),
            psicologo=PsicologoProfileResponse.model_validate(ps),
        )
