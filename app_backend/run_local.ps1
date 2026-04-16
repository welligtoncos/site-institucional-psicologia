param(
    [switch]$WithInfra = $true
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "==> Preparando ambiente virtual"
if (!(Test-Path ".\.venv\Scripts\python.exe")) {
    python -m venv .venv
}

$python = ".\.venv\Scripts\python.exe"

Write-Host "==> Instalando dependencias"
& $python -m pip install -r requirements.txt

if ($WithInfra) {
    Write-Host "==> Subindo infraestrutura (Postgres, RabbitMQ, MongoDB)"
    docker compose up -d db rabbitmq mongo
}

Write-Host "==> Aplicando migrations"
& $python -m alembic upgrade head

Write-Host "==> Iniciando API FastAPI em http://127.0.0.1:8000"
& $python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
