"""Entrada de debug — delega para `main.run_uvicorn` (modo debug estável)."""

from main import run_uvicorn

if __name__ == "__main__":
    run_uvicorn(host="127.0.0.1", port=8000, reload=False, debug_mode=True)
