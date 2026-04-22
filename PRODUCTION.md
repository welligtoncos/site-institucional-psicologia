# Produção — Clínica Harmonia

Checklist para subir o stack (Next + FastAPI + Postgres + RabbitMQ + Mongo) com segurança e comportamento previsível.

## 1. Segredos e variáveis

| Variável | Obrigatório | Notas |
|----------|-------------|--------|
| `SECRET_KEY` | Sim | Chave longa e aleatória para JWT. Nunca use o valor de exemplo. |
| `DATABASE_URL` | Sim | URL `postgresql+asyncpg://...` apontando para o Postgres gerenciado. |
| `DEBUG` | Recomendado `false` | Com `false`, a API **exige** `CORS_ORIGINS` não vazio e não usa `*`. |
| `CORS_ORIGINS` | Sim se `DEBUG=false` | Lista separada por vírgulas das origens do site (ex.: `https://app.clinica.com,https://www.clinica.com`). Inclua a origem exata do navegador (esquema + host + porta se houver). |
| `RABBITMQ_URL` / `MONGO_URI` | Sim no compose completo | Alinhe com credenciais fortes em produção. |

No **Next.js** (build e runtime):

- `BACKEND_API_URL`: URL da API **vista pelo servidor Next** (rotas BFF / Server Actions), ex.: `http://api:8000` no Docker ou `https://api.sua-clinica.com` atrás do balanceador.
- `NEXT_PUBLIC_BACKEND_API_URL`: URL da API **vista pelo browser** (chamadas do cliente e **WebSocket**). Deve ser HTTPS em produção e o mesmo host que o usuário usa para evitar bloqueios de cookie/CORS/mixed content.

## 2. CORS e HTTPS

- Termine TLS no balanceador (Traefik, Nginx, Caddy, cloud LB) e sirva o frontend em `https://`.
- A API deve ser acessível em HTTPS se o front for HTTPS; `NEXT_PUBLIC_BACKEND_API_URL` deve ser `wss://` / `https://` coerente para o WebSocket `/ws/appointments/{id}`.
- Ajuste `CORS_ORIGINS` para as origens reais do front (sem barra final).

## 3. WebSocket e escala da API

O estado da **sala em tempo real** (`RoomRealtimeService`) fica **em memória por processo** Uvicorn.

- O `Dockerfile` e o `docker-compose.yml` sobem a API com **`--workers 1`**. Mantenha **uma réplica** do serviço de API por trás do LB **ou** sticky sessions por consulta se no futuro houver vários workers.
- Para vários processos com WS correto entre nós, será necessário um barramento (ex.: Redis Pub/Sub) e revisão de presença na sala — fora do escopo mínimo atual.

## 4. Docker Compose

```bash
# Defina SECRET_KEY, CORS_ORIGINS, senhas fortes de Postgres/Rabbit/Mongo no .env ou no ambiente
docker compose up --build -d
```

- **Mongo Express** (porta 8081): útil em desenvolvimento; em produção, não exponha na internet ou remova o serviço.
- Use `restart: unless-stopped` nos serviços (já aplicado em `api` e `frontend` na raiz).

## 5. Banco e migrações

- O container da API executa `alembic upgrade head` antes do Uvicorn.
- Faça backup periódico do volume Postgres (`pgdata`).

## 6. Next.js

- O `Dockerfile` do front já usa `NODE_ENV=production` e `npm run build`.
- Revise `RESEND_*`, `CLINIC_CONTACT_EMAIL` e tokens admin conforme o ambiente.

## 7. Teste rápido pós-deploy

- `GET /health` e `GET /health/db` na API.
- Login no portal e no psicólogo; fluxo de sala online com **mesma origem** no navegador (evitar misturar `localhost` e `127.0.0.1`).

Para detalhes de portas locais, veja o `README.md` na raiz e `app_backend/README.md`.
