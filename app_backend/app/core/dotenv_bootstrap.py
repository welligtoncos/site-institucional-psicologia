"""Carrega `.env`: no host, sobrescreve variáveis globais; no Docker Compose preserva `DATABASE_URL` com `@db`."""

import os
import json
import time
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv


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
def load_project_dotenv(project_root: Path | None = None) -> None:
    if project_root is None:
        project_root = Path(__file__).resolve().parents[2]
    env_path = project_root / ".env"
    preserved = os.environ.get("DATABASE_URL")
    # region agent log
    preserved_host = urlparse(preserved).hostname if preserved else None
    _agent_log(
        "H1",
        "app/core/dotenv_bootstrap.py:load_project_dotenv",
        "before_load_dotenv",
        {"env_path_exists": env_path.exists(), "preserved_host": preserved_host},
    )
    # endregion
    load_dotenv(env_path, override=True)
    if preserved and "@db:" in preserved:
        os.environ["DATABASE_URL"] = preserved
    # region agent log
    effective = os.environ.get("DATABASE_URL")
    effective_host = urlparse(effective).hostname if effective else None
    _agent_log(
        "H1",
        "app/core/dotenv_bootstrap.py:load_project_dotenv",
        "after_load_dotenv",
        {
            "effective_host": effective_host,
            "preserved_applied": bool(preserved and "@db:" in preserved),
        },
    )
    # endregion
    # Garante que Settings() releia os.environ após alterar o .env (evita segredo antigo em get_settings cacheado).
    try:
        from app.core.config import get_settings

        get_settings.cache_clear()
    except Exception:
        pass
