"""Carrega `.env`: no host, sobrescreve variáveis globais; no Docker Compose preserva `DATABASE_URL` com `@db`."""

import os
from pathlib import Path

from dotenv import load_dotenv


def load_project_dotenv(project_root: Path | None = None) -> None:
    if project_root is None:
        project_root = Path(__file__).resolve().parents[2]
    env_path = project_root / ".env"
    preserved = os.environ.get("DATABASE_URL")
    load_dotenv(env_path, override=True)
    if preserved and "@db:" in preserved:
        os.environ["DATABASE_URL"] = preserved
