"""Modelos ORM — importe aqui para o Alembic enxergar as tabelas."""

from app.models.product import Product
from app.models.user import User
from app.models.clinical import (
    BloqueioAgenda,
    Cobranca,
    Consulta,
    DisponibilidadeSemanal,
    Paciente,
    Psicologo,
    SessaoAoVivo,
)

__all__ = [
    "User",
    "Product",
    "Paciente",
    "Psicologo",
    "Consulta",
    "Cobranca",
    "SessaoAoVivo",
    "DisponibilidadeSemanal",
    "BloqueioAgenda",
]
