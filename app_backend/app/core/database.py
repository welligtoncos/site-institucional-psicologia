"""
SQLAlchemy 2.0 assíncrono: engine `asyncpg`, sessão por request e URL síncrona para Alembic.

A aplicação usa `postgresql+asyncpg://`. Migrações Alembic usam `postgresql+psycopg://`
( driver síncrono ), derivado automaticamente.
"""

from collections.abc import AsyncGenerator
import json
import time

from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


# region agent log
def _agent_log(hypothesis_id: str, location: str, message: str, data: dict) -> None:
    try:
        with open("debug-0d85e0.log", "a", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {
                        "sessionId": "0d85e0",
                        "runId": "pre-fix",
                        "hypothesisId": hypothesis_id,
                        "location": location,
                        "message": message,
                        "data": data,
                        "timestamp": int(time.time() * 1000),
                    },
                    ensure_ascii=True,
                )
                + "\n"
            )
    except Exception:
        pass


# endregion
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
    # region agent log
    _agent_log(
        "H2",
        "app/core/database.py:get_sync_database_url",
        "sync_url_generated",
        {"drivername": u.drivername, "host": u.host, "port": u.port, "database": u.database},
    )
    # endregion
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
