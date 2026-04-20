# Passo a passo: configuração na nuvem

Este guia descreve como colocar o stack do **Clínica Harmonia** (Next.js + FastAPI + PostgreSQL + RabbitMQ + MongoDB) em ambiente de nuvem de forma segura e reproduzível.

## O que você vai subir

| Componente        | Função                                      |
|-------------------|---------------------------------------------|
| `frontend`        | Site Next.js (porta interna 3000)         |
| `api`             | API FastAPI + migrações Alembic (8000)    |
| `audit_consumer`  | Consumer RabbitMQ → MongoDB (auditoria)   |
| `db`              | PostgreSQL 16                               |
| `rabbitmq`        | Fila AMQP + painel de gestão                |
| `mongo`           | MongoDB (eventos de auditoria)            |
| `mongo_express`   | UI web do Mongo (**não recomendado** em produção pública) |

---

## 1) Escolha o modelo de hospedagem

### Opção recomendada para este repositório: **uma VM com Docker Compose**

O `docker-compose.yml` da raiz já orquestra todos os serviços. Em uma VPS (Ubuntu LTS, por exemplo) você replica o ambiente local com menos surpresas.

**Provedores comuns:** DigitalOcean Droplet, Hetzner Cloud, AWS EC2, Azure VM, Google Compute Engine, Oracle Cloud Free Tier, etc.

### Opção alternativa: **PaaS + bancos gerenciados**

Dá para hospedar frontend (ex.: Vercel) e API (ex.: Railway, Render, Fly.io) separadamente, mas você precisará:

- Instâncias gerenciadas de **PostgreSQL**, **RabbitMQ** (ou CloudAMQP) e **MongoDB Atlas** (ou similar).
- Ajustar `DATABASE_URL`, `RABBITMQ_URL`, `MONGO_URI` e `CORS_ORIGINS` para apontar para esses hosts.
- Garantir que o **consumer** (`audit_consumer`) rode em algum lugar com acesso ao RabbitMQ e ao Mongo.

Este documento foca no fluxo **VM + Docker Compose**, que é o mais direto com o que já existe no projeto.

---

## 2) Pré-requisitos na máquina da nuvem

1. Sistema operacional atualizado (ex.: Ubuntu 22.04 ou 24.04 LTS).
2. [Docker Engine](https://docs.docker.com/engine/install/) e [Docker Compose plugin](https://docs.docker.com/compose/install/linux/) instalados.
3. Firewall liberando apenas o que for público:
   - **80** e **443** (HTTP/HTTPS) se usar proxy reverso na mesma VM.
   - **22** (SSH) restrito ao seu IP, se possível.
4. **Não** exponha na internet, sem necessidade:
   - PostgreSQL, RabbitMQ (5672), MongoDB, Mongo Express, painel RabbitMQ (15672).

---

## 3) Obter o código no servidor

```bash
sudo apt update && sudo apt install -y git
git clone <URL_DO_SEU_REPOSITORIO> site-institucional-psicologia
cd site-institucional-psicologia
```

---

## 4) Configurar variáveis de ambiente

### 4.1 Arquivo `.env` na raiz (Compose)

Crie um arquivo `.env` na **raiz do repositório** (mesmo nível do `docker-compose.yml`) com valores **fortes** e únicos para produção. Exemplo de estrutura (ajuste nomes e segredos):

```env
# Segredos do stack
SECRET_KEY=<gere_uma_string_longa_aleatoria>
POSTGRES_USER=app
POSTGRES_PASSWORD=<senha_forte>
POSTGRES_DB=appdb

RABBITMQ_DEFAULT_USER=app
RABBITMQ_DEFAULT_PASS=<senha_forte>

MONGO_INITDB_ROOT_USERNAME=app
MONGO_INITDB_ROOT_PASSWORD=<senha_forte>

# Frontend / integrações
ADMIN_API_TOKEN=<token_forte_para_admin>
RESEND_API_KEY=<sua_chave_resend>
RESEND_FROM_EMAIL=Clinica Harmonia <noreply@seudominio.com>
CLINIC_CONTACT_EMAIL=contato@seudominio.com
AVAILABILITY_DAYS_AHEAD=21

# Opcional: portas no host (se não quiser os padrões)
# FRONTEND_PORT=3000
# API_HOST_PORT=8000
```

### 4.2 Backend (`app_backend/.env` ou uso de `env_file`)

O serviço `api` e o `audit_consumer` usam `app_backend/.env.example` como `env_file` no Compose. Para produção:

1. Copie para um arquivo real usado em produção, por exemplo `app_backend/.env` (e **não** commite esse arquivo).
2. Ajuste pelo menos:
   - `CORS_ORIGINS`: URLs **HTTPS** do seu site (ex.: `https://www.seudominio.com,https://seudominio.com`).
   - `DEBUG=false`.

**Importante:** Dentro do Docker, a API já recebe `DATABASE_URL`, `RABBITMQ_URL`, `MONGO_URI` etc. pelo `environment` do `docker-compose.yml`. O `env_file` complementa com `CORS_ORIGINS`, `APP_NAME`, etc. Garanta que `CORS_ORIGINS` inclua a origem do frontend em produção.

### 4.3 URLs do backend no frontend

No Compose, o serviço `frontend` usa `BACKEND_API_URL` e `NEXT_PUBLIC_BACKEND_API_URL` apontando para `http://api:8000`, o que é correto **entre containers**.

Para o **browser** (chamadas do cliente), você normalmente expõe a API em um subdomínio (ex.: `https://api.seudominio.com`) e define `NEXT_PUBLIC_BACKEND_API_URL` com essa URL pública. Isso pode exigir ajuste do `docker-compose.yml` ou de um arquivo de build/args conforme sua estratégia de deploy.

Checklist mínimo:

- `NEXT_PUBLIC_*` deve ser acessível pelo navegador do usuário (HTTPS).
- `CORS_ORIGINS` na API deve listar o domínio do Next.

---

## 5) Subir a aplicação

Na raiz do projeto:

```bash
docker compose pull   # se usar imagens públicas sem build local
docker compose up -d --build
```

Verifique saúde dos serviços:

```bash
docker compose ps
docker compose logs -f api --tail=100
```

URLs úteis **na própria VM** (localhost):

- App: `http://127.0.0.1:3000` (ou a porta definida em `FRONTEND_PORT`)
- API: `http://127.0.0.1:8000` (ou `API_HOST_PORT`)
- Docs: `http://127.0.0.1:8000/docs`

---

## 6) Proxy reverso e HTTPS

Não publique o Next diretamente na internet sem TLS. Fluxo típico:

1. Instalar **Caddy** ou **Nginx** (ou Traefik) na VM.
2. Obter certificado **Let's Encrypt** para `seudominio.com` e `www.seudominio.com` (e `api.seudominio.com` se separar a API).
3. Encaminhar:
   - `https://seudominio.com` → `127.0.0.1:3000` (frontend)
   - `https://api.seudominio.com` → `127.0.0.1:8000` (API), se usar subdomínio.

Após isso, atualize `CORS_ORIGINS` e as variáveis `NEXT_PUBLIC_BACKEND_API_URL` / `BACKEND_API_URL` de acordo com os domínios finais e faça **rebuild** do frontend se necessário.

---

## 7) DNS

No painel do seu registrador ou DNS (Cloudflare, Route53, etc.):

1. Registro **A** (ou **AAAA** para IPv6) apontando `@` e `www` para o IP público da VM.
2. Se usar API em subdomínio, registro **A** para `api`.

Aguarde a propagação antes de emitir certificados TLS.

---

## 8) E-mail (Resend)

1. Crie conta em [https://resend.com](https://resend.com).
2. Verifique o **domínio** de envio e configure SPF/DKIM conforme a documentação do Resend.
3. Preencha `RESEND_API_KEY` e `RESEND_FROM_EMAIL` com um remetente **autorizado**.
4. `CLINIC_CONTACT_EMAIL` é o destino dos agendamentos.

---

## 9) Segurança em produção

1. **Troque todos os padrões** (`app`/`app`/`admin`) de senhas e tokens.
2. **Remova ou não exponha** `mongo_express` e o painel **15672** do RabbitMQ para a internet; use túnel SSH ou VPN se precisar administrar.
3. Mantenha o SO e o Docker atualizados; configure **backups** do volume PostgreSQL (`pgdata`) e do Mongo (`mongo_data`).
4. Restrinja **SSH** por chave e, se possível, por IP.
5. Revise `SECRET_KEY` (JWT) — deve ser longa e aleatória.

---

## 10) Checklist final antes de ir ao ar

- [ ] `.env` na raiz com segredos fortes
- [ ] `app_backend` com `CORS_ORIGINS` contendo o domínio HTTPS do site
- [ ] `RESEND_*` e domínio de e-mail validados
- [ ] HTTPS ativo no proxy reverso
- [ ] `NEXT_PUBLIC_BACKEND_API_URL` coerente com a URL pública da API
- [ ] `docker compose up -d` sem erros; consumer de auditoria em execução
- [ ] Portas internas de banco e fila **não** abertas na firewall pública
- [ ] Backup e plano de restauração do PostgreSQL (e Mongo, se necessário)

---

## 11) Atualizações contínuas

```bash
cd site-institucional-psicologia
git pull
docker compose up -d --build
```

Monitore logs após cada deploy (`docker compose logs`).

---

## Referência rápida de variáveis (Compose)

| Variável | Onde impacta |
|----------|----------------|
| `SECRET_KEY` | JWT / segurança da API |
| `POSTGRES_*` | Banco da API |
| `RABBITMQ_*` | Fila e consumer |
| `MONGO_*` | Auditoria no Mongo |
| `ADMIN_API_TOKEN` | Rotas admin do frontend (disponibilidade) |
| `RESEND_*`, `CLINIC_CONTACT_EMAIL` | Envio de e-mails de contato |
| `AVAILABILITY_DAYS_AHEAD` | Janela de dias para disponibilidade |

Para detalhes locais adicionais, consulte o `README.md` do repositório.
