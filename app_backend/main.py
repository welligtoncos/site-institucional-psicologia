"""Aplicação FastAPI: CORS, erros de domínio, rotas e healthchecks."""

import json
import logging
import time

from app.core.dotenv_bootstrap import load_project_dotenv

load_project_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError, ConflictError, ForbiddenError, NotFoundError
from app.routes import api_router

settings = get_settings()
logger = logging.getLogger(__name__)


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
_cors_origins = settings.cors_origin_list() if not settings.debug else ["*"]
if not settings.debug and not _cors_origins:
    raise RuntimeError(
        "Defina CORS_ORIGINS (lista separada por vírgulas) quando DEBUG=false. "
        "Ex.: https://app.sua-clinica.com,https://www.sua-clinica.com",
    )
if not settings.debug:
    logger.info("CORS: origens explícitas (%d). DEBUG=false.", len(_cors_origins))
else:
    logger.warning("CORS: allow_origins=['*'] (modo DEBUG). Não use em produção.")


def _operational_error_detail(exc: OperationalError) -> str:
    return str(exc.orig) if exc.orig is not None else str(exc)


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="API com auth JWT (access + refresh): **POST /auth/register**, **POST /auth/login**.",
)

# Login usa JSON + JWT no header (sem cookie). Em produção (DEBUG=false) usamos CORS_ORIGINS explícitas.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AuthenticationError)
async def _auth(_: Request, exc: AuthenticationError) -> JSONResponse:
    return JSONResponse(status_code=401, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
async def _conflict(_: Request, exc: ConflictError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(NotFoundError)
async def _not_found(_: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ForbiddenError)
async def _forbidden(_: Request, exc: ForbiddenError) -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(OperationalError)
async def _db_unavailable(_: Request, exc: OperationalError) -> JSONResponse:
    err_msg = _operational_error_detail(exc)
    logger.error("PostgreSQL: %s", err_msg)
    payload: dict = {
        "detail": "Não foi possível conectar ao banco de dados. Verifique DATABASE_URL e se o PostgreSQL está acessível.",
    }
    if settings.debug:
        payload["debug"] = err_msg
    return JSONResponse(status_code=503, content=payload)


@app.exception_handler(ConnectionRefusedError)
async def _connection_refused(_: Request, exc: ConnectionRefusedError) -> JSONResponse:
    """asyncpg às vezes propaga recusa de TCP antes do wrapper SQLAlchemy (ex.: Postgres parado)."""
    logger.error("Conexão recusada (serviço indisponível?): %s", exc)
    payload: dict = {
        "detail": "Não foi possível conectar ao banco de dados. Suba o PostgreSQL (ex.: docker compose up -d db) ou ajuste DATABASE_URL (host/porta).",
    }
    if settings.debug:
        payload["debug"] = str(exc)
    return JSONResponse(status_code=503, content=payload)


@app.exception_handler(RequestValidationError)
async def _request_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    body_preview = ""
    try:
        raw = await request.body()
        body_preview = raw.decode("utf-8", errors="replace")[:500]
    except Exception:
        body_preview = "<unavailable>"
    # region agent log
    _agent_log(
        "H5",
        "main.py:_request_validation_error",
        "request_validation_error",
        {
            "path": str(request.url.path),
            "method": request.method,
            "errors": exc.errors(),
            "body_preview": body_preview,
        },
    )
    # endregion
    logger.error("422 validation error on %s: %s | body=%s", request.url.path, exc.errors(), body_preview)
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


app.include_router(api_router)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db", tags=["system"], summary="Testa conexão assíncrona com PostgreSQL")
async def health_db() -> dict[str, str]:
    from app.core.database import async_engine

    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except OperationalError as exc:
        err = _operational_error_detail(exc)
        logger.error("health/db: %s", err)
        raise HTTPException(status_code=503, detail=f"Banco indisponível: {err}") from exc
    return {"database": "ok"}


def run_uvicorn(
    *,
    host: str = "0.0.0.0",
    port: int = 8000,
    reload: bool | None = None,
    debug_mode: bool = False,
) -> None:
    """
    Arranque único do servidor.

    `debug_mode=True`: objeto `app`, HTTP h11, sem reload (melhor para breakpoints no Cursor).
    `debug_mode=False`: import string `main:app` e `reload` conforme `settings.debug` se `reload` for `None`.
    """
    import uvicorn

    if debug_mode:
        uvicorn.run(
            app,
            host=host,
            port=port,
            reload=False,
            log_level="info",
            loop="asyncio",
            http="h11",
        )
        return
    if reload is None:
        reload = settings.debug
    uvicorn.run("main:app", host=host, port=port, reload=reload)


if __name__ == "__main__":
    run_uvicorn(host="0.0.0.0", port=8000, debug_mode=False)
