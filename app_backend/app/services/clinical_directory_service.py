"""Listagens de pacientes e psicólogos (uso administrativo)."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.psychologist_profile import is_professional_profile_complete
from app.repositories.clinical_repository import ClinicalRepository
from app.schemas.auth_schema import UserResponse
from app.schemas.profile_schema import (
    PatientListResponse,
    PatientMeResponse,
    PacienteProfileResponse,
    PsychologistListResponse,
    PsychologistMeResponse,
    PsicologoProfileResponse,
)


class ClinicalDirectoryService:
    def __init__(self, db: AsyncSession) -> None:
        self._clinical = ClinicalRepository(db)

    async def list_patients(self, *, skip: int, limit: int) -> PatientListResponse:
        rows = await self._clinical.list_pacientes(skip=skip, limit=limit)
        items = [
            PatientMeResponse(
                user=UserResponse.model_validate(p.usuario),
                paciente=PacienteProfileResponse.model_validate(p),
            )
            for p in rows
        ]
        return PatientListResponse(items=items, skip=skip, limit=limit)

    async def list_psychologists(self, *, skip: int, limit: int) -> PsychologistListResponse:
        rows = await self._clinical.list_psicologos(skip=skip, limit=limit)
        items = [
            PsychologistMeResponse(
                user=UserResponse.model_validate(p.usuario),
                psicologo=PsicologoProfileResponse.model_validate(p),
                professional_profile_complete=is_professional_profile_complete(p.usuario, p),
            )
            for p in rows
        ]
        return PsychologistListResponse(items=items, skip=skip, limit=limit)
