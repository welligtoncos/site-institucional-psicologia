"""
SQLAlchemy 2.0 assíncrono: engine `asyncpg`, sessão por request e URL síncrona para Alembic.

A aplicação usa `postgresql+asyncpg://`. Migrações Alembic usam `postgresql+psycopg://`
( driver síncrono ), derivado automaticamente.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Base declarativa para todos os modelos ORM."""


def get_database_url() -> str:
    """URL assíncrona usada pela API (`postgresql+asyncpg://`)."""
    u = make_url(get_settings().database_url.strip())
    if u.drivername != "postgresql+asyncpg":
        u = u.set(drivername="postgresql+asyncpg")
    return u.render_as_string(hide_password=False)


def get_sync_database_url() -> str:
    """
    URL síncrona para Alembic (psycopg v3).
    Converte asyncpg → psycopg mantendo host, user, senha e banco.
    """
    u = make_url(get_database_url())
    u = u.set(drivername="postgresql+psycopg")
    return u.render_as_string(hide_password=False)


async_engine = create_async_engine(
    get_database_url(),
    pool_pre_ping=True,
    echo=get_settings().debug,
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency FastAPI: uma `AsyncSession` por request.
    O commit ocorre nos repositórios após operações de escrita.
    """
    async with AsyncSessionLocal() as session:
        yield session
