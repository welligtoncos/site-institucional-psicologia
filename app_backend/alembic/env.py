"""Alembic — URL síncrona (`postgresql+psycopg`) derivada da mesma config que a API."""

from logging.config import fileConfig
from pathlib import Path
import json
import sys
import time
from sqlalchemy.engine.url import make_url

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.dotenv_bootstrap import load_project_dotenv  # noqa: E402

load_project_dotenv(ROOT)

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.database import Base, get_sync_database_url  # noqa: E402
import app.models  # noqa: F401, E402

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


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
def run_migrations_offline() -> None:
    context.configure(
        url=get_sync_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_sync_database_url()
    # region agent log
    parsed = make_url(configuration["sqlalchemy.url"])
    _agent_log(
        "H3",
        "alembic/env.py:run_migrations_online",
        "before_engine_connect",
        {"host": parsed.host, "port": parsed.port, "database": parsed.database},
    )
    # endregion
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    try:
        with connectable.connect() as connection:
            # region agent log
            _agent_log(
                "H3",
                "alembic/env.py:run_migrations_online",
                "engine_connect_success",
                {"host": parsed.host, "port": parsed.port},
            )
            # endregion
            context.configure(connection=connection, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()
    except Exception as exc:
        # region agent log
        _agent_log(
            "H3",
            "alembic/env.py:run_migrations_online",
            "engine_connect_error",
            {"error_type": type(exc).__name__, "error": str(exc)[:300]},
        )
        # endregion
        raise


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
