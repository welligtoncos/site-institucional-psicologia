"""Catálogo de profissionais para o portal do paciente."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError
from app.models.user import User, UserRole
from app.repositories.clinical_repository import ClinicalRepository
from app.schemas.catalog_schema import PsychologistCatalogItem, parse_especialidades_csv


class CatalogService:
    def __init__(self, db: AsyncSession) -> None:
        self._clinical = ClinicalRepository(db)

    async def list_psychologists_catalog(self, user: User, *, skip: int = 0, limit: int = 100) -> list[PsychologistCatalogItem]:
        if user.role != UserRole.patient:
            raise ForbiddenError("Apenas pacientes podem consultar o catálogo de profissionais.")
        rows = await self._clinical.list_psicologos_ativos_catalog(skip=skip, limit=limit)
        out: list[PsychologistCatalogItem] = []
        for ps in rows:
            u = ps.usuario
            nome = (u.name or "").strip() or "Profissional"
            out.append(
                PsychologistCatalogItem(
                    id=ps.id,
                    nome=nome,
                    crp=ps.crp,
                    bio=ps.bio or "",
                    valor_consulta=ps.valor_sessao_padrao,
                    duracao_minutos=ps.duracao_minutos_padrao,
                    foto_url=ps.foto_url,
                    especialidades=parse_especialidades_csv(ps.especialidades),
                )
            )
        return out
