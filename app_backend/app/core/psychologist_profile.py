"""Regra de negócio: perfil profissional considerado completo (portal do psicólogo)."""

from decimal import Decimal

from app.models.clinical import Psicologo
from app.models.user import User
from app.schemas.catalog_schema import parse_especialidades_csv


def is_professional_profile_complete(user: User, ps: Psicologo) -> bool:
    """Exige nome, CRP, biografia (mín. 10), valor > 0, foto (URL ou data URL) e ao menos uma especialidade."""
    if not (user.name or "").strip():
        return False
    if not (ps.crp or "").strip():
        return False
    if len((ps.bio or "").strip()) < 10:
        return False
    if ps.valor_sessao_padrao is None or ps.valor_sessao_padrao <= Decimal("0"):
        return False
    if not (ps.foto_url or "").strip():
        return False
    if len(parse_especialidades_csv(ps.especialidades)) < 1:
        return False
    return True
