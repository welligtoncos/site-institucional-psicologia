# API FastAPI — Auth JWT + PostgreSQL (async)

## Start rápido (Windows PowerShell)

Comando único para preparar e subir local:

```powershell
powershell -ExecutionPolicy Bypass -File .\run_local.ps1
```

Esse script:

- cria `.venv` se não existir
- instala dependências
- sobe `db`, `rabbitmq` e `mongo` no Docker
- aplica migrations (`alembic upgrade head`)
- inicia a API em `http://127.0.0.1:8000`

## Requisitos

- Python 3.12+ (local) ou Docker + Docker Compose
- PostgreSQL 16 (via Compose ou instalado localmente)

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste `DATABASE_URL`, `SECRET_KEY` e demais campos.

O `main.py` e o `alembic/env.py` carregam o `.env` com **prioridade sobre variáveis já definidas no ambiente** (por exemplo `DATABASE_URL` antiga no Windows). Sem isso, o Pydantic pode ignorar o `.env` em favor do valor global do sistema.

### Host do Postgres: `127.0.0.1` vs `db`

| Onde você roda o comando | `DATABASE_URL` deve usar |
|--------------------------|---------------------------|
| `alembic` ou `uvicorn` **no Windows** contra o Postgres **deste** Compose | `...@127.0.0.1:5433/...` (porta publicada no host; padrão `POSTGRES_PORT=5433`) |
| Postgres **instalado** no Windows (outra porta) | a porta que esse servidor usa (geralmente 5432) |
| Apenas **dentro do container** `api` | O Compose define `@db:5432` automaticamente |

Se aparecer **`getaddrinfo failed`**, o `.env` provavelmente aponta para o host **`db`**, que só existe na rede Docker. Corrija para **`127.0.0.1`** ao rodar Alembic na sua máquina.

Se aparecer **falha de autenticação** para `app` ou `postgres`, confira **porta e usuário**: na **5432** pode estar o PostgreSQL local (outras credenciais); para o banco do Compose use **`127.0.0.1:5433`** e `app`/`app`/`appdb`.

## Local (sem Docker, Postgres instalado)

```bash
python -m venv .venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
# No .env: DATABASE_URL com host/porta do seu Postgres e credenciais reais
alembic upgrade head
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Só o banco no Docker, API e Alembic no PC

O Compose expõe o Postgres do container em **`127.0.0.1:5433`** (porta **5433** no host, não 5432), para não conflitar com um PostgreSQL instalado no Windows que costuma ocupar a **5432**. Se `alembic` mostrar falha de senha para o usuário `app` usando a porta **5432**, você provavelmente está conectando no Postgres errado.

```bash
docker compose up -d db
# Após alterar a porta no compose, recrie o container: docker compose up -d --force-recreate db
# No .env: DATABASE_URL=...@127.0.0.1:5433/appdb  (usuário/senha/banco: app/app/appdb)
alembic upgrade head
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Docker Compose (API + banco + frontend + mensageria + auditoria)

Na pasta `app_backend`:

```bash
cp .env.example .env
# Edite .env: defina SECRET_KEY. DATABASE_URL com 127.0.0.1 no .env é ignorado pelo serviço api
# (o compose injeta @db:5432 no container).
docker compose up --build
```

### Portas no host (`.env`)

| Variável | Padrão | Função |
|----------|--------|--------|
| `FRONTEND_PORT` | `9080` | Onde o Nginx publica o Angular no host. |
| `API_HOST_PORT` | `8000` | Onde a API FastAPI é publicada no host. Use `8001` (ou outra) se aparecer *port is already allocated* na 8000. |

### URLs comuns (exemplo alinhado ao `.env`: `FRONTEND_PORT=9080`, `API_HOST_PORT=8001`)

- **Login (app)**: http://localhost:9080/login  
- **Swagger direto na API (host)**: http://localhost:8001/docs  
- **Swagger pelo mesmo origin do app** (proxy Nginx → `/docs` na API): http://localhost:9080/api/docs  
- **Raiz do app**: http://localhost:9080/  
- **Health**: http://localhost:8001/health e http://localhost:8001/health/db (troque `8001` pela sua `API_HOST_PORT`).

O Nginx do serviço `frontend` encaminha `/api/*` para `http://api:8000/` na rede Docker (porta interna do container da API é sempre **8000**).

- RabbitMQ Management: http://localhost:15672 (padrão: `app` / `app`)
- MongoDB: localhost:27017 (padrão: `app` / `app`)
- Mongo Express: http://localhost:8081 (padrão: `admin` / `admin`)

### Fluxo RabbitMQ

- Producer: CRUD de produtos publica `product.created`, `product.updated`, `product.deleted` na exchange `products.events`.
- Consumer: serviço `audit_consumer` consome `product.*` e grava auditoria assíncrona no MongoDB (`auditdb.product_events`).
- Consumer: serviço `business_audit_consumer` consome eventos de negócio (`user.account.created.*`, `availability.*`, `appointment.*`) e grava em `auditdb.business_events`.
- Falhas básicas: retry por header `x-retries` (até 3), depois DLQ `audit.log.dlq`.

Para ver logs do consumer:

```bash
docker compose logs -f audit_consumer
```

Para logs da auditoria de negócio:

```bash
docker compose logs -f business_audit_consumer
```

## Alembic (migrations)

Gerar nova revisão a partir dos modelos (quando alterar `app/models/`):

```bash
alembic revision --autogenerate -m "descreva a mudança"
```

Aplicar migrações no banco:

```bash
alembic upgrade head
```

Reverter um passo:

```bash
alembic downgrade -1
```

Ver histórico:

```bash
alembic history
```

## Estrutura

- `app/routes/` — apenas roteamento HTTP
- `app/services/` — regras de negócio (sem SQL)
- `app/repositories/` — queries com `AsyncSession`
- `app/models/` — ORM SQLAlchemy
- `app/schemas/` — Pydantic v2
- `app/core/` — config, DB assíncrono, segurança JWT
