"""
Configuração comum dos testes.

Define DATABASE_URL e SECRET_KEY antes de qualquer import de `app`, porque o
módulo de banco lê a config ao ser carregado (evita erro de Settings incompleto).
"""

from __future__ import annotations

import os

os.environ["DATABASE_URL"] = "postgresql+asyncpg://app:app@127.0.0.1:5432/testdb"
os.environ["SECRET_KEY"] = "unit-test-secret-key-at-least-32-characters-long"
os.environ["DEBUG"] = "true"
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")


def pytest_configure() -> None:
    """Limpa o cache de settings para cada execução do pytest."""
    from app.core.config import get_settings

    get_settings.cache_clear()
