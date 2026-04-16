"""Modelos ORM — importe aqui para o Alembic enxergar as tabelas."""

from app.models.product import Product
from app.models.user import User

__all__ = ["User", "Product"]
