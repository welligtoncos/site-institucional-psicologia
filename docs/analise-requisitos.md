# Análise de requisitos — Clínica Harmonia (site + portal + ERP em evolução)

## 1. Introdução

### 1.1 Propósito

Este documento consolida **requisitos funcionais e não funcionais** identificados no repositório (Next.js, mocks no navegador, FastAPI), servindo de base para evolução do **ERP da clínica**, APIs e persistência.

### 1.2 Escopo

| Dentro do escopo atual | Fora ou futuro |
|------------------------|----------------|
| Site institucional, contato, agendamento de demonstração | Integração real com gateway de pagamento e NF-e |
| Portal do paciente (autenticado) | App mobile nativo |
| Área do psicólogo (demonstração) | Multi-clínica e multi-tenant completo |
| Sessão ao vivo **mock** (mesmo navegador / origem) | Videoconferência embutida na página |
| Cadastro e auth via **backend** (RF-001) | Biometria / SSO corporativo |

### 1.3 Referências

- Modelo de dados lógico: [`diagrama-classes-banco-dados.mmd`](./diagrama-classes-banco-dados.mmd), [`diagrama-classes.md`](./diagrama-classes.md)
- Modelagem dos tipos mock no front: [`modelagem-classes.mmd`](./modelagem-classes.mmd)
- Backend auth: `app_backend/app/schemas/auth_schema.py`, `app_backend/app/services/auth_service.py`, `app_backend/app/routes/auth.py`

---

## 2. Partes interessadas

| Stakeholder | Interesse principal |
|-------------|---------------------|
| **Paciente** | Agendar, pagar, ver consultas, entrar no atendimento online, privacidade |
| **Psicólogo** | Agenda, sessão com link e cronômetro, identificação do paciente na espera |
| **Recepção / financeiro** (futuro ERP) | Cobranças, conciliação, cadastros |
| **Clínica (gestão)** | Relatórios, políticas, LGPD |
| **Equipe de desenvolvimento** | APIs estáveis, testes, documentação OpenAPI |

---

## 3. Visão geral do sistema

O produto combina:

1. **Site público** — institucional, contato, formulários de interesse.
2. **Portal do paciente** (`/portal`) — após login: resumo da jornada, consultas, financeiro mock, atendimento ao vivo, perfil.
3. **Área do psicólogo** (`/psicologo`) — agenda, sessão ao vivo, pacientes e faturas (mocks onde aplicável).
4. **Backend FastAPI** — registro (RF-001), login, refresh, `/auth/me`; demais recursos a expandir.
5. **Estado de sessão ao vivo (demo)** — `localStorage` + `BroadcastChannel` entre abas do **mesmo origin** (ex.: só `localhost:3000`).

---

## 4. Requisitos funcionais

### 4.1 Autenticação e cadastro (backend)

| ID | Descrição | Origem / evidência |
|----|-------------|---------------------|
| **RF-001** | Cadastro de **paciente**: nome, e-mail, telefone, senha (mín. 8 caracteres), **aceite explícito de termos** (`accept_terms` obrigatoriamente verdadeiro). Senha persistida como hash (bcrypt). Telefone e data de aceite de termos persistidos. | `UserRegisterRequest`, `auth_service`, migração Alembic, testes |
| **RF-002** | Papéis de usuário: **patient**, **psychologist**, **admin** (controle de acesso e JWT). | `UserRoleSchema`, `user.py` |
| **RF-003** | **Login** com e-mail e senha; resposta com tokens de acesso e renovação. | Rotas `/auth/login` |
| **RF-004** | **Refresh** de token para manter sessão sem novo login a cada requisição. | `/auth/refresh` |
| **RF-005** | **Perfil autenticado**: endpoint protegido que devolve dados do usuário logado (sem senha). | `/auth/me`, proxy Next `/api/portal/me` |
| **RF-006** | Tratamento adequado para **token inválido ou expirado** (401, fluxo de logout / re-login). | Comentários em `auth.py` / portal |

### 4.2 Portal do paciente (front)

| ID | Descrição |
|----|-----------|
| **RF-007** | **Início do portal**: saudação, próxima consulta (data, hora, psicólogo, modalidade, status, valor), **ação principal** contextual (ex.: pagar, confirmar fluxo, entrar no atendimento online). |
| **RF-008** | **Minhas consultas**: listar futuras e histórico; filtros; cancelar e remarcar respeitando **antecedência mínima** (`PORTAL_CANCEL_MIN_HOURS`). |
| **RF-009** | **Cobrança vinculada à consulta**: criar registro financeiro (mock) com identificadores de integração futura (intent id); associar `chargeId` à consulta. | `portal-payment-mock.ts`, `portal-mocks` |
| **RF-010** | **Simulação de retorno do gateway**: marcar cobrança como paga e **atualizar** consulta (pagamento e, se aplicável, status). | `registerGatewayPaymentSuccess` |
| **RF-011** | **Atendimento ao vivo (demo)**: paciente entra na sala de espera; vê link quando o psicólogo envia; cronômetro **só** após play no painel do psicólogo; estados de fase (espera / ao vivo / encerrado). |
| **RF-012** | **Perfil / cadastro**: edição de dados do paciente na demonstração. | `/portal/perfil` |
| **RF-013** | **Agendar** nova consulta (fluxo de demonstração com slots mockados). | `/portal/agendar` |

### 4.3 Área do psicólogo (front)

| ID | Descrição |
|----|-----------|
| **RF-014** | **Agenda**: visualizar consultas do dia (mock), origem portal vs agenda. |
| **RF-015** | **Sessão online**: selecionar consulta; salvar link Meet/Zoom; abrir sala; **iniciar cronômetro** conforme regras (janela de horário e/ou paciente na espera + demo); encerrar sessão e refletir conclusão na consulta (mock). |
| **RF-016** | Identificar **qual paciente** está na sala de espera (nome + ref da consulta). |
| **RF-017** | Listagens de **pacientes** e **faturas** (mocks) para navegação da área profissional. |

### 4.4 Regras de negócio — sessão ao vivo (demonstração)

| ID | Descrição |
|----|-----------|
| **RN-001** | Estado compartilhado persiste em **uma chave** de `localStorage` e propaga via **evento** + **BroadcastChannel** + polling curto. |
| **RN-002** | Paciente e psicólogo devem usar o **mesmo origin** (ex.: não misturar `localhost` com `127.0.0.1`). |
| **RN-003** | Com paciente na espera **e** link salvo, o play do psicólogo pode sofrer **espera mínima** (`PSYCH_START_MIN_WAIT_MS`) antes de liberar (simulação). |
| **RN-004** | Encerramento da sessão ao vivo **marca consulta como realizada** no mock do portal quando a ref for `portal:{id}`. |

---

## 5. Requisitos não funcionais

| ID | Categoria | Descrição |
|----|-----------|-----------|
| **RNF-001** | Segurança | Senhas nunca retornadas em API; JWT para acesso; HTTPS em produção. |
| **RNF-002** | Privacidade / ética | Dados sensíveis de saúde mental tratados com **sigilo**; linguagem acolhedora no portal; conformidade LGPD como meta de produto. |
| **RNF-003** | Usabilidade | Dashboard do paciente com **ação principal** evidente; fluxo em passos na sessão (link → sala → play). |
| **RNF-004** | Manutenibilidade | Domínio de consultas/cobranças centralizado em `portal-mocks` / `portal-payment-mock`; substituir por API real sem mudar regras de produto na documentação. |
| **RNF-005** | Observabilidade | Erros de auth tratados com mensagens claras; toasts no front para feedback de pagamento e sessão (demo). |

---

## 6. Premissas e restrições

1. **Demonstração no navegador**: parte do financeiro e da sessão ao vivo **não** substitui banco nem gateway real até a implementação ERP/API.
2. **Backend**: usuários reais de cadastro/login dependem do serviço FastAPI e variáveis de ambiente (`getBackendApiUrl` etc.).
3. **Unificação futura**: entidades `Consulta`, `Cobranca`, `SessaoAoVivo` no modelo lógico ([`diagrama-classes-banco-dados.mmd`](./diagrama-classes-banco-dados.mmd)) substituirão gradualmente os mocks.

---

## 7. Matriz de rastreabilidade (resumo)

| Requisito | Artefato principal |
|-----------|---------------------|
| RF-001–006 | `app_backend` — auth, schemas, testes |
| RF-007–013 | `app/components/portal/*`, `app/portal/*` |
| RF-014–017 | `app/components/psicologo/*`, `app/lib/psicologo-mocks.ts` |
| RF-009–010 | `app/lib/portal-payment-mock.ts` |
| RF-011, RN-001–004 | `app/lib/live-session-shared.ts`, boards de sessão |

---

## 8. Glossário

| Termo | Significado |
|--------|-------------|
| **Origin** | Esquema + host + porta do URL; define o isolamento do `localStorage`. |
| **Charge / cobrança** | Registro financeiro associado a uma consulta (RF-009). |
| **Sala de espera** | Fase em que o paciente aguarda link e início oficial (cronômetro). |
| **Play** | Ação do psicólogo que inicia o tempo oficial da sessão na demo. |

---

## 9. Controle de versão deste documento

| Versão | Data | Notas |
|--------|------|-------|
| 1.0 | 2026-04-17 | Consolidação inicial a partir do código e diagramas em `docs/`. |
