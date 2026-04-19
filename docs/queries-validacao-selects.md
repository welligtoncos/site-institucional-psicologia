# SELECTs para validação (PostgreSQL)

Use estes comandos no **mesmo banco** que a API (`appdb`, usuário `app`). Com Docker Compose do backend, a porta no host costuma ser **5433** (não 5432).

## Entrar no `psql`

Na pasta `app_backend`:

```bash
docker compose exec db psql -U app -d appdb
```

Atalhos úteis dentro do `psql`:

| Comando | Efeito |
|---------|--------|
| `\dt` | Lista tabelas do schema `public` |
| `\d nome_tabela` | Colunas e índices de uma tabela |
| `\q` | Sair |

---

## 1. Visão geral do schema

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

---

## 2. Usuários e papéis (paciente / psicólogo / admin)

```sql
SELECT id, name, email, role::text AS role, is_active, created_at
FROM users
ORDER BY created_at DESC
LIMIT 50;
```

Só pacientes:

```sql
SELECT u.id, u.name, u.email, u.is_active
FROM users u
WHERE u.role = 'patient'::user_role_enum
ORDER BY u.email;
```

Só psicólogos:

```sql
SELECT u.id, u.name, u.email, p.crp, p.valor_sessao_padrao, p.duracao_minutos_padrao
FROM users u
JOIN psicologos p ON p.usuario_id = u.id
WHERE u.role = 'psychologist'::user_role_enum
ORDER BY u.email;
```

---

## 3. Pacientes (perfil clínico ligado ao `users`)

```sql
SELECT
  pac.id AS paciente_id,
  u.email,
  u.name,
  pac.cpf,
  pac.cidade,
  pac.uf,
  pac.criado_em
FROM pacientes pac
JOIN users u ON u.id = pac.usuario_id
ORDER BY pac.criado_em DESC;
```

---

## 4. Disponibilidade semanal (base do cálculo de slots)

`dia_semana`: 0 = domingo … 6 = sábado (igual ao cadastro na API).

```sql
SELECT
  d.id,
  p.crp,
  u.name AS psicologo,
  d.dia_semana,
  d.ativo,
  d.hora_inicio,
  d.hora_fim
FROM disponibilidade_semanal d
JOIN psicologos p ON p.id = d.psicologo_id
JOIN users u ON u.id = p.usuario_id
ORDER BY u.name, d.dia_semana, d.hora_inicio;
```

Por um psicólogo específico (troque o UUID):

```sql
SELECT *
FROM disponibilidade_semanal
WHERE psicologo_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY dia_semana, hora_inicio;
```

---

## 5. Bloqueios de agenda

```sql
SELECT
  b.id,
  u.name AS psicologo,
  p.crp,
  b.data_bloqueio,
  b.dia_inteiro,
  b.hora_inicio,
  b.hora_fim,
  LEFT(b.motivo, 80) AS motivo
FROM bloqueios_agenda b
JOIN psicologos p ON p.id = b.psicologo_id
JOIN users u ON u.id = p.usuario_id
ORDER BY b.data_bloqueio DESC, u.name
LIMIT 100;
```

---

## 6. Consultas (agenda + vínculo paciente/psicólogo)

Resumo com nomes:

```sql
SELECT
  c.id,
  c.data_agendada,
  c.hora_inicio,
  c.duracao_minutos,
  c.modalidade::text AS modalidade,
  c.status::text AS status,
  c.situacao_pagamento::text AS pagamento,
  c.valor_acordado,
  up.name AS paciente,
  ups.name AS psicologo,
  pg.crp,
  c.criado_em,
  c.atualizado_em
FROM consultas c
JOIN pacientes pa ON pa.id = c.paciente_id
JOIN users up ON up.id = pa.usuario_id
JOIN psicologos pg ON pg.id = c.psicologo_id
JOIN users ups ON ups.id = pg.usuario_id
ORDER BY c.data_agendada DESC, c.hora_inicio DESC
LIMIT 100;
```

Só consultas que **ainda ocupam** horário no cálculo de slots (`agendada`, `confirmada`, `em_andamento`):

```sql
SELECT c.id, c.data_agendada, c.hora_inicio, c.status::text
FROM consultas c
WHERE c.status IN (
  'agendada'::consulta_status,
  'confirmada'::consulta_status,
  'em_andamento'::consulta_status
)
ORDER BY c.data_agendada, c.hora_inicio;
```

Conflito potencial (mesmo psicólogo, mesma data/hora, status ativo — a aplicação também usa índice único parcial):

```sql
SELECT psicologo_id, data_agendada, hora_inicio, COUNT(*) AS q
FROM consultas
WHERE status NOT IN ('cancelada'::consulta_status, 'nao_compareceu'::consulta_status)
GROUP BY psicologo_id, data_agendada, hora_inicio
HAVING COUNT(*) > 1;
```

---

## 7. Cobranças (gateway mock)

```sql
SELECT
  cb.id,
  cb.consulta_id,
  cb.valor_centavos,
  cb.status_gateway::text AS status_gateway,
  cb.id_intent_gateway,
  cb.criado_em,
  cb.pago_em
FROM cobrancas cb
ORDER BY cb.criado_em DESC
LIMIT 50;
```

Com dados da consulta:

```sql
SELECT
  cb.status_gateway::text,
  c.data_agendada,
  c.hora_inicio,
  c.situacao_pagamento::text AS situacao_pagamento_consulta
FROM cobrancas cb
JOIN consultas c ON c.id = cb.consulta_id
ORDER BY cb.criado_em DESC
LIMIT 30;
```

---

## 8. Sessão ao vivo (fase, link, tempos)

```sql
SELECT
  s.id,
  s.consulta_id,
  s.fase::text AS fase,
  LEFT(s.url_meet, 60) AS url_meet_prefix,
  s.paciente_entrou_em,
  s.cronometro_iniciado_em,
  s.encerrada_em,
  s.atualizado_em
FROM sessoes_ao_vivo s
ORDER BY s.atualizado_em DESC
LIMIT 30;
```

---

## 9. Checagens rápidas de integridade

Contagens por papel:

```sql
SELECT role::text, COUNT(*) FROM users GROUP BY role ORDER BY 1;
```

Consultas por status:

```sql
SELECT status::text, COUNT(*) FROM consultas GROUP BY status ORDER BY 1;
```

Paciente sem linha em `pacientes` (não deveria existir se o fluxo de cadastro estiver completo):

```sql
SELECT u.id, u.email, u.name
FROM users u
WHERE u.role = 'patient'::user_role_enum
  AND NOT EXISTS (SELECT 1 FROM pacientes p WHERE p.usuario_id = u.id);
```

Psicólogo sem `disponibilidade_semanal` (slots podem ficar vazios):

```sql
SELECT p.id, u.name, u.email
FROM psicologos p
JOIN users u ON u.id = p.usuario_id
WHERE NOT EXISTS (SELECT 1 FROM disponibilidade_semanal d WHERE d.psicologo_id = p.id);
```

---

## Notas

- Os tipos enum no PostgreSQL aparecem como `consulta_status`, `consulta_modalidade`, `user_role_enum`, etc. Use `::text` para ver o valor como string.
- O **Next.js** do portal ainda usa **mocks em `localStorage`** para parte da jornada (consultas mock, pagamento simulado). Esses dados **não** aparecem nestas tabelas até existir API que persista consulta/cobrança no Postgres.
- Para validar **só o backend** (disponibilidade + `bookable-slots`), garanta dados em `psicologos`, `disponibilidade_semanal`, `bloqueios_agenda` e `consultas` coerentes com o que você espera nos `SELECT` acima.
