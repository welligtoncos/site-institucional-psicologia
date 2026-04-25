"""Wait until PostgreSQL is reachable before migrations."""

from __future__ import annotations

import os
import time

import psycopg
from sqlalchemy.engine.url import make_url


def _sync_url_from_env() -> str:
    raw = os.environ["DATABASE_URL"].strip()
    url = make_url(raw)
    if url.drivername != "postgresql+psycopg":
        url = url.set(drivername="postgresql+psycopg")
    return url.render_as_string(hide_password=False)


def main() -> int:
    dsn = _sync_url_from_env()
    max_attempts = int(os.getenv("DB_WAIT_MAX_ATTEMPTS", "30"))
    interval_seconds = float(os.getenv("DB_WAIT_INTERVAL_SECONDS", "1.0"))

    for attempt in range(1, max_attempts + 1):
        try:
            with psycopg.connect(dsn, connect_timeout=3) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            print(f"[wait_for_db] database is ready on attempt {attempt}")
            return 0
        except Exception as exc:
            print(f"[wait_for_db] attempt {attempt}/{max_attempts} failed: {exc}")
            if attempt == max_attempts:
                break
            time.sleep(interval_seconds)

    print("[wait_for_db] database did not become ready in time")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
