"""Aplicação FastAPI: CORS, erros de domínio, rotas e healthchecks."""

import logging

from app.core.dotenv_bootstrap import load_project_dotenv

load_project_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError, ConflictError, NotFoundError
from app.routes import api_router

settings = get_settings()
logger = logging.getLogger(__name__)


def _operational_error_detail(exc: OperationalError) -> str:
    return str(exc.orig) if exc.orig is not None else str(exc)


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="API com auth JWT (access + refresh): **POST /auth/register**, **POST /auth/login**.",
)

# Login usa JSON + JWT no header (sem cookie). `allow_origins=["*"]` exige `allow_credentials=False`
# (senão o browser exige origem explícita e o preflight OPTIONS pode falhar com 400).
# Em produção com cookies ou origens fixas, troque por `cors_origin_list()` + `allow_credentials=True`.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
