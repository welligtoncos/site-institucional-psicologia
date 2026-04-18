# Validação manual do PostgreSQL (tabelas, tipos, relacionamentos)

Guia para conferir o schema no banco de teste (ex.: `appdb_test`) via Docker + `psql`.

**Pré-requisito:** Postgres do Compose no ar; banco criado e com migrações/schema aplicados (`appdb_test`).

**Conexão típica (host):** `localhost` · **porta:** `5433` · **usuário/senha:** `app` / `app` (padrão do `docker-compose.yml`).

---

## 1. Listar tabelas do schema `public`

```bash
docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "\dt public.*"
```

Resumo curto:

```bash
docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "\dt"
```

Com mais detalhe (tamanho, etc.):

```bash
docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "\dt+ public.*"
```

---

## 2. Descrever uma tabela (colunas, tipos, defaults, índices)

Substitua `consultas` pelo nome da tabela (`pacientes`, `psicologos`, `cobrancas`, etc.):

```bash
docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "\d+ consultas"
```

---

## 3. Modo interativo (recomendado para explorar)

```bash
docker compose -f app_backend/docker-compose.yml exec db psql -U app -d appdb_test
```

Dentro do `psql`:

- `\d+ consultas` — estrutura detalhada
- `\dt public.*` — lista de tabelas
- `\q` — sair

---

## 4. Foreign keys (relacionamentos)

Lista quem referencia quem nas tabelas do domínio clínico (+ `users` / `products` se quiser incluir na lista `IN`):

```bash
docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'pacientes','psicologos','consultas','cobrancas','sessoes_ao_vivo',
    'disponibilidade_semanal','bloqueios_agenda'
  )
ORDER BY tc.table_name, kcu.ordinal_position;
"
```

---

## 5. Colunas, tipos SQL e defaults

```bash
docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "
SELECT table_name, column_name, data_type, udt_name,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'pacientes','psicologos','consultas','cobrancas','sessoes_ao_vivo',
    'disponibilidade_semanal','bloqueios_agenda','users','products'
  )
ORDER BY table_name, ordinal_position;
"
```

Para colunas **ENUM**, costuma aparecer `data_type = USER-DEFINED` e `udt_name` com o nome do tipo (ex.: `consulta_status`).

---

## 6. Valores dos tipos ENUM no catálogo

```bash
docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "
SELECT t.typname AS enum_name, e.enumlabel AS value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;
"
```

---

## 7. Checks, uniques e outras constraints (definição completa)

```bash
docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conrelid::regclass::text ~ '^(pacientes|psicologos|consultas|cobrancas|sessoes_ao_vivo|disponibilidade_semanal|bloqueios_agenda)$'
ORDER BY 1, 2;
"
```

---

## 8. Roteiro de dados de teste (opcional)

Após o schema estar aplicado (Alembic `005` e/ou `docs/schema-fisico-postgresql.sql`), você pode carregar o fluxo manual descrito em:

- `docs/queries-manual-fluxo-completo.txt`

Instruções de execução estão no cabeçalho desse arquivo.

---

## Referência rápida

| Objetivo              | Comando / origem                          |
|-----------------------|-------------------------------------------|
| Só nomes de tabelas   | `\dt` / `\dt public.*`                    |
| Colunas e tipos       | `\d+ nome_tabela`                         |
| FKs em SQL            | consulta da seção 4                       |
| Tipos ENUM            | consulta da seção 6                       |
| Dados de teste        | `docs/queries-manual-fluxo-completo.txt`  |


-----------------------------------------------------------------------------------------
PS D:\WELLIGTON_PROJETOS_DESAFIOS_2026\site-institucional-psicologia> docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "\dt public.*" 
                List of relations
 Schema |          Name           | Type  | Owner 
--------+-------------------------+-------+-------
 public | alembic_version         | table | app
 public | bloqueios_agenda        | table | app
 public | cobrancas               | table | app
 public | consultas               | table | app
 public | disponibilidade_semanal | table | app
 public | pacientes               | table | app
 public | products                | table | app
 public | psicologos              | table | app
 public | sessoes_ao_vivo         | table | app
 public | users                   | table | app
(10 rows)

PS D:\WELLIGTON_PROJETOS_DESAFIOS_2026\site-institucional-psicologia> docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "\dt"
                List of relations
 Schema |          Name           | Type  | Owner
--------+-------------------------+-------+-------
 public | alembic_version         | table | app
 public | bloqueios_agenda        | table | app
 public | cobrancas               | table | app
 public | consultas               | table | app
 public | disponibilidade_semanal | table | app
 public | pacientes               | table | app
 public | products                | table | app
 public | psicologos              | table | app
 public | sessoes_ao_vivo         | table | app
 public | users                   | table | app
(10 rows)

PS D:\WELLIGTON_PROJETOS_DESAFIOS_2026\site-institucional-psicologia> docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "\dt+ public.*"
                                                                           List of relations
 Schema |          Name           | Type  | Owner | Persistence | Access method |    Size    |                
               Description
--------+-------------------------+-------+-------+-------------+---------------+------------+-------------------------------------------------------------------------
 public | alembic_version         | table | app   | permanent   | heap          | 8192 bytes |
 public | bloqueios_agenda        | table | app   | permanent   | heap          | 16 kB      |
 public | cobrancas               | table | app   | permanent   | heap          | 8192 bytes | Uma cobrança ativa por consulta (1:1); intent id para gateway.
 public | consultas               | table | app   | permanent   | heap          | 16 kB      | Agendamento; status e pagamento alinhados ao portal mock.
 public | disponibilidade_semanal | table | app   | permanent   | heap          | 8192 bytes |
 public | pacientes               | table | app   | permanent   | heap          | 16 kB      | Perfil clínico do paciente; nome/e-mail/telefone em users.
 public | products                | table | app   | permanent   | heap          | 8192 bytes |
 public | psicologos              | table | app   | permanent   | heap          | 16 kB      | Perfil profissional; role esperado: psychologist em users.
 public | sessoes_ao_vivo         | table | app   | permanent   | heap          | 16 kB      | Estado da teleconsulta; fases alinhadas ao front (live-session-shared).
 public | users                   | table | app   | permanent   | heap          | 16 kB      |
(10 rows)

PS D:\WELLIGTON_PROJETOS_DESAFIOS_2026\site-institucional-psicologia> docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "\d+ consultas"
                                                                            Table "public.consultas"
           Column           |            Type             | Collation | Nullable |                 Default                 | Storage  | Compression | Stats target | Description
----------------------------+-----------------------------+-----------+----------+-----------------------------------------+----------+-------------+--------------+-------------
 id                         | uuid                        |           | not null | gen_random_uuid()          
             | plain    |             |              |
 paciente_id                | uuid                        |           | not null |                            
             | plain    |             |              |
 psicologo_id               | uuid                        |           | not null |                            
             | plain    |             |              |
 data_agendada              | date                        |           | not null |                            
             | plain    |             |              |
 hora_inicio                | time without time zone      |           | not null |                            
             | plain    |             |              |
 duracao_minutos            | smallint                    |           | not null | 50                         
             | plain    |             |              |
 modalidade                 | consulta_modalidade         |           | not null |                            
             | plain    |             |              |
 status                     | consulta_status             |           | not null | 'agendada'::consulta_status             | plain    |             |              |
 situacao_pagamento         | consulta_situacao_pagamento |           | not null | 'Pendente'::consulta_situacao_pagamento | plain    |             |              |
 valor_acordado             | numeric(12,2)               |           | not null |                            
             | main     |             |              |
 especialidade_atendida     | character varying(120)      |           | not null | ''::character varying                   | extended |             |              |
 link_videochamada_opcional | text                        |           |          |                            
             | extended |             |              |
 observacoes                | text                        |           | not null | ''::text                   
             | extended |             |              |
 criado_em                  | timestamp with time zone    |           | not null | now()                      
             | plain    |             |              |
 atualizado_em              | timestamp with time zone    |           | not null | now()                      
             | plain    |             |              |
Indexes:
    "consultas_pkey" PRIMARY KEY, btree (id)
    "ix_consultas_paciente_data" btree (paciente_id, data_agendada)
    "ix_consultas_psicologo_data" btree (psicologo_id, data_agendada)
    "ix_consultas_status" btree (status)
    "uq_consultas_psicologo_inicio" UNIQUE, btree (psicologo_id, data_agendada, hora_inicio) WHERE status <> ALL (ARRAY['cancelada'::consulta_status, 'nao_compareceu'::consulta_status])
Foreign-key constraints:
    "consultas_paciente_id_fkey" FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE RESTRICT        
    "consultas_psicologo_id_fkey" FOREIGN KEY (psicologo_id) REFERENCES psicologos(id) ON DELETE RESTRICT     
Referenced by:
    TABLE "cobrancas" CONSTRAINT "cobrancas_consulta_id_fkey" FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE RESTRICT
    TABLE "sessoes_ao_vivo" CONSTRAINT "sessoes_ao_vivo_consulta_id_fkey" FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE CASCADE
Access method: heap

PS D:\WELLIGTON_PROJETOS_DESAFIOS_2026\site-institucional-psicologia> docker compose -f app_backend/docker-compose.yml exec db psql -U app -d appdb_test
psql (16.13)
Type "help" for help.

appdb_test=# \d+ consultas
                                                                            Table "public.consultas"
           Column           |            Type             | Collation | Nullable |                 Default                 | Storage  | Compression | Stats target | Description
----------------------------+-----------------------------+-----------+----------+-----------------------------------------+----------+-------------+--------------+-------------
 id                         | uuid                        |           | not null | gen_random_uuid()          
             | plain    |             |              |
 paciente_id                | uuid                        |           | not null |                            
             | plain    |             |              |
 psicologo_id               | uuid                        |           | not null |                            
             | plain    |             |              |
 data_agendada              | date                        |           | not null |                            
             | plain    |             |              |  
 hora_inicio                | time without time zone      |           | not null |                            
             | plain    |             |              |
 duracao_minutos            | smallint                    |           | not null | 50                         
             | plain    |             |              |
 modalidade                 | consulta_modalidade         |           | not null |                            
             | plain    |             |              |
 status                     | consulta_status             |           | not null | 'agendada'::consulta_status             | plain    |             |              |
 situacao_pagamento         | consulta_situacao_pagamento |           | not null | 'Pendente'::consulta_situacao_pagamento | plain    |             |              |
 valor_acordado             | numeric(12,2)               |           | not null |                            
             | main     |             |              |  
--More--
appdb_test=# 
appdb_test=# \dt public.*
                List of relations
 Schema |          Name           | Type  | Owner
--------+-------------------------+-------+-------
 public | alembic_version         | table | app
 public | bloqueios_agenda        | table | app
 public | cobrancas               | table | app
 public | consultas               | table | app
 public | disponibilidade_semanal | table | app
 public | pacientes               | table | app
 public | products                | table | app
 public | psicologos              | table | app
 public | sessoes_ao_vivo         | table | app
 public | users                   | table | app
(10 rows)

appdb_test=# \q
PS D:\WELLIGTON_PROJETOS_DESAFIOS_2026\site-institucional-psicologia> docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "
>> SELECT
>>   tc.table_name,
>>   kcu.column_name,
>>   ccu.table_name AS foreign_table,
>>   ccu.column_name AS foreign_column,
>>   tc.constraint_name
>> FROM information_schema.table_constraints tc
>> JOIN information_schema.key_column_usage kcu
>>   ON tc.constraint_name = kcu.constraint_name
>>   AND tc.table_schema = kcu.table_schema
>> JOIN information_schema.constraint_column_usage ccu
>>   ON ccu.constraint_name = tc.constraint_name
>>   AND ccu.table_schema = tc.table_schema
>> WHERE tc.constraint_type = 'FOREIGN KEY'
>>   AND tc.table_schema = 'public'
>>   AND tc.table_name IN (
>>     'pacientes','psicologos','consultas','cobrancas','sessoes_ao_vivo',
>>     'disponibilidade_semanal','bloqueios_agenda'
>>   )
>> ORDER BY tc.table_name, kcu.ordinal_position;
>> "
       table_name        | column_name  | foreign_table | foreign_column |              constraint_name       

-------------------------+--------------+---------------+----------------+-------------------------------------------
 bloqueios_agenda        | psicologo_id | psicologos    | id             | bloqueios_agenda_psicologo_id_fkey 
 cobrancas               | consulta_id  | consultas     | id             | cobrancas_consulta_id_fkey
 consultas               | paciente_id  | pacientes     | id             | consultas_paciente_id_fkey
 consultas               | psicologo_id | psicologos    | id             | consultas_psicologo_id_fkey        
 disponibilidade_semanal | psicologo_id | psicologos    | id             | disponibilidade_semanal_psicologo_id_fkey
 pacientes               | usuario_id   | users         | id             | pacientes_usuario_id_fkey
 psicologos              | usuario_id   | users         | id             | psicologos_usuario_id_fkey
 sessoes_ao_vivo         | consulta_id  | consultas     | id             | sessoes_ao_vivo_consulta_id_fkey   
(8 rows)

PS D:\WELLIGTON_PROJETOS_DESAFIOS_2026\site-institucional-psicologia> docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "
>> SELECT table_name, column_name, data_type, udt_name,
>>        is_nullable, column_default
>> FROM information_schema.columns
>> WHERE table_schema = 'public'
>>   AND table_name IN (
>>     'pacientes','psicologos','consultas','cobrancas','sessoes_ao_vivo',
>>     'disponibilidade_semanal','bloqueios_agenda','users','products'
>>   )
>> ORDER BY table_name, ordinal_position;
>> "
       table_name        |        column_name         |        data_type         |          udt_name          
 | is_nullable |               column_default
-------------------------+----------------------------+--------------------------+-----------------------------+-------------+---------------------------------------------
 bloqueios_agenda        | id                         | uuid                     | uuid                       
 | NO          | gen_random_uuid()
 bloqueios_agenda        | psicologo_id               | uuid                     | uuid                       
 | NO          |
 bloqueios_agenda        | data_bloqueio              | date                     | date                       
 | NO          |
 bloqueios_agenda        | dia_inteiro                | boolean                  | bool                       
 | NO          | true
 bloqueios_agenda        | hora_inicio                | time without time zone   | time                       
 | YES         |
 bloqueios_agenda        | hora_fim                   | time without time zone   | time                       
 | YES         |
 bloqueios_agenda        | motivo                     | text                     | text                       
 | NO          | ''::text
 cobrancas               | id                         | uuid                     | uuid                       
 | NO          | gen_random_uuid()
 cobrancas               | consulta_id                | uuid                     | uuid                       
 | NO          |
 cobrancas               | valor_centavos             | bigint                   | int8                       
 | NO          |
 cobrancas               | moeda                      | character                | bpchar                     
 | NO          | 'BRL'::bpchar
 cobrancas               | provedor_gateway           | character varying        | varchar                    
 | NO          | 'stripe_compatible_mock'::character varying
 cobrancas               | id_intent_gateway          | character varying        | varchar                    
 | NO          |
 cobrancas               | status_gateway             | USER-DEFINED             | cobranca_status_gateway     | NO          | 'awaiting_payment'::cobranca_status_gateway
 cobrancas               | criado_em                  | timestamp with time zone | timestamptz                
 | NO          | now()
 cobrancas               | pago_em                    | timestamp with time zone | timestamptz                
 | YES         |
 consultas               | id                         | uuid                     | uuid                       
 | NO          | gen_random_uuid()
 consultas               | paciente_id                | uuid                     | uuid                       
 | NO          |
 consultas               | psicologo_id               | uuid                     | uuid                       
 | NO          |
 consultas               | data_agendada              | date                     | date                       
 | NO          |
 consultas               | hora_inicio                | time without time zone   | time                       
 | NO          |
 consultas               | duracao_minutos            | smallint                 | int2                       
 | NO          | 50
 consultas               | modalidade                 | USER-DEFINED             | consulta_modalidade         | NO          |
 consultas               | status                     | USER-DEFINED             | consulta_status            
 | NO          | 'agendada'::consulta_status
 consultas               | situacao_pagamento         | USER-DEFINED             | consulta_situacao_pagamento | NO          | 'Pendente'::consulta_situacao_pagamento
 consultas               | valor_acordado             | numeric                  | numeric                    
 | NO          |
 consultas               | especialidade_atendida     | character varying        | varchar                    
 | NO          | ''::character varying
 consultas               | link_videochamada_opcional | text                     | text                       
 | YES         |
 consultas               | observacoes                | text                     | text                       
 | NO          | ''::text
 consultas               | criado_em                  | timestamp with time zone | timestamptz                
 | NO          | now()
 consultas               | atualizado_em              | timestamp with time zone | timestamptz                
 | NO          | now()
 disponibilidade_semanal | id                         | uuid                     | uuid                       
 | NO          | gen_random_uuid()
 disponibilidade_semanal | psicologo_id               | uuid                     | uuid                       
 | NO          |
 disponibilidade_semanal | dia_semana                 | smallint                 | int2                       
 | NO          |
 disponibilidade_semanal | ativo                      | boolean                  | bool                       
 | NO          | true
 disponibilidade_semanal | hora_inicio                | time without time zone   | time                       
 | NO          |
 disponibilidade_semanal | hora_fim                   | time without time zone   | time                       
 | NO          |
 pacientes               | id                         | uuid                     | uuid                       
 | NO          | gen_random_uuid()
 pacientes               | usuario_id                 | uuid                     | uuid                       
 | NO          |
 pacientes               | contato_emergencia         | text                     | text                       
 | YES         |
 pacientes               | criado_em                  | timestamp with time zone | timestamptz                
 | NO          | now()
 products                | id                         | uuid                     | uuid                       
 | NO          |
 products                | nome                       | character varying        | varchar                    
 | NO          |
 products                | descricao                  | text                     | text                       
 | NO          | ''::text
 products                | preco                      | numeric                  | numeric                    
 | NO          |
 products                | quantidade                 | integer                  | int4                       
 | NO          | 0
 products                | ativo                      | boolean                  | bool                       
 | NO          | true
 products                | created_at                 | timestamp with time zone | timestamptz                
 | NO          | now()
 products                | updated_at                 | timestamp with time zone | timestamptz                
 | NO          | now()
 psicologos              | id                         | uuid                     | uuid                       
 | NO          | gen_random_uuid()
 psicologos              | usuario_id                 | uuid                     | uuid                       
 | NO          |
 psicologos              | crp                        | character varying        | varchar                    
 | NO          |
 psicologos              | bio                        | text                     | text                       
 | NO          | ''::text
 psicologos              | valor_sessao_padrao        | numeric                  | numeric                    
 | NO          | 0
 psicologos              | duracao_minutos_padrao     | smallint                 | int2                       
 | NO          | 50
 psicologos              | criado_em                  | timestamp with time zone | timestamptz                
 | NO          | now()
 sessoes_ao_vivo         | id                         | uuid                     | uuid                       
 | NO          | gen_random_uuid()
 sessoes_ao_vivo         | consulta_id                | uuid                     | uuid                       
 | NO          |
 sessoes_ao_vivo         | fase                       | USER-DEFINED             | sessao_ao_vivo_fase         | NO          | 'patient_waiting'::sessao_ao_vivo_fase
 sessoes_ao_vivo         | url_meet                   | text                     | text                       
 | YES         |
 sessoes_ao_vivo         | paciente_entrou_em         | timestamp with time zone | timestamptz                
 | YES         |
 sessoes_ao_vivo         | desbloqueio_play_em        | timestamp with time zone | timestamptz                
 | YES         |
 sessoes_ao_vivo         | cronometro_iniciado_em     | timestamp with time zone | timestamptz                
 | YES         |
 sessoes_ao_vivo         | encerrada_em               | timestamp with time zone | timestamptz                
 | YES         |
 sessoes_ao_vivo         | atualizado_em              | timestamp with time zone | timestamptz                
 | NO          | now()
 users                   | id                         | uuid                     | uuid                       
 | NO          |
 users                   | name                       | character varying        | varchar                    
 | NO          |
 users                   | email                      | character varying        | varchar                    
 | NO          |
 users                   | password_hash              | character varying        | varchar                    
 | NO          |
 users                   | role                       | USER-DEFINED             | user_role_enum             
 | NO          | 'patient'::user_role_enum
 users                   | is_active                  | boolean                  | bool                       
 | NO          | true
 users                   | created_at                 | timestamp with time zone | timestamptz                
 | NO          | now()
 users                   | updated_at                 | timestamp with time zone | timestamptz                
 | NO          | now()
 users                   | phone                      | character varying        | varchar                    
 | NO          | ''::character varying
 users                   | terms_accepted_at          | timestamp with time zone | timestamptz                
 | YES         |
(75 rows)

PS D:\WELLIGTON_PROJETOS_DESAFIOS_2026\site-institucional-psicologia> docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "
>> SELECT t.typname AS enum_name, e.enumlabel AS value
>> FROM pg_type t
>> JOIN pg_enum e ON t.oid = e.enumtypid
>> JOIN pg_namespace n ON n.oid = t.typnamespace
>> WHERE n.nspname = 'public'
>> ORDER BY t.typname, e.enumsortorder;
>> "
          enum_name          |      value       
-----------------------------+------------------
 cobranca_status_gateway     | awaiting_payment
 cobranca_status_gateway     | succeeded
 cobranca_status_gateway     | failed
 consulta_modalidade         | Online
 consulta_modalidade         | Presencial
 consulta_situacao_pagamento | Pago
 consulta_situacao_pagamento | Pendente
 consulta_status             | agendada
 consulta_status             | confirmada
 consulta_status             | em_andamento
 consulta_status             | realizada
 consulta_status             | cancelada
 consulta_status             | nao_compareceu
 sessao_ao_vivo_fase         | patient_waiting
 sessao_ao_vivo_fase         | live
 sessao_ao_vivo_fase         | ended
 user_role_enum              | patient
 user_role_enum              | psychologist
 user_role_enum              | admin
(19 rows)

PS D:\WELLIGTON_PROJETOS_DESAFIOS_2026\site-institucional-psicologia> docker compose -f app_backend/docker-compose.yml exec -T db psql -U app -d appdb_test -c "
>> SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
>> FROM pg_constraint
>> WHERE connamespace = 'public'::regnamespace
>>   AND conrelid::regclass::text ~ '^(pacientes|psicologos|consultas|cobrancas|sessoes_ao_vivo|disponibilidade_semanal|bloqueios_agenda)$'
>> ORDER BY 1, 2;
>> "
       table_name        |                  conname                  |                                        
     pg_get_constraintdef
-------------------------+-------------------------------------------+--------------------------------------------------------------------------------------------------------------
 pacientes               | pacientes_pkey                            | PRIMARY KEY (id)
 pacientes               | pacientes_usuario_id_fkey                 | FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
 pacientes               | pacientes_usuario_id_key                  | UNIQUE (usuario_id)
 psicologos              | psicologos_pkey                           | PRIMARY KEY (id)
 psicologos              | psicologos_usuario_id_fkey                | FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
 psicologos              | psicologos_usuario_id_key                 | UNIQUE (usuario_id)
 consultas               | consultas_paciente_id_fkey                | FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE RESTRICT
 consultas               | consultas_pkey                            | PRIMARY KEY (id)
 consultas               | consultas_psicologo_id_fkey               | FOREIGN KEY (psicologo_id) REFERENCES psicologos(id) ON DELETE RESTRICT
 cobrancas               | cobrancas_consulta_id_fkey                | FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE RESTRICT
 cobrancas               | cobrancas_consulta_id_key                 | UNIQUE (consulta_id)
 cobrancas               | cobrancas_pkey                            | PRIMARY KEY (id)
 cobrancas               | cobrancas_valor_centavos_check            | CHECK ((valor_centavos >= 0))
 sessoes_ao_vivo         | sessoes_ao_vivo_consulta_id_fkey          | FOREIGN KEY (consulta_id) REFERENCES consultas(id) ON DELETE CASCADE
 sessoes_ao_vivo         | sessoes_ao_vivo_consulta_id_key           | UNIQUE (consulta_id)
 sessoes_ao_vivo         | sessoes_ao_vivo_pkey                      | PRIMARY KEY (id)
 disponibilidade_semanal | ck_disponibilidade_janela                 | CHECK ((hora_fim > hora_inicio))       
 disponibilidade_semanal | disponibilidade_semanal_dia_semana_check  | CHECK (((dia_semana >= 0) AND (dia_semana <= 6)))
 disponibilidade_semanal | disponibilidade_semanal_pkey              | PRIMARY KEY (id)
 disponibilidade_semanal | disponibilidade_semanal_psicologo_id_fkey | FOREIGN KEY (psicologo_id) REFERENCES psicologos(id) ON DELETE CASCADE
 bloqueios_agenda        | bloqueios_agenda_pkey                     | PRIMARY KEY (id)
 bloqueios_agenda        | bloqueios_agenda_psicologo_id_fkey        | FOREIGN KEY (psicologo_id) REFERENCES psicologos(id) ON DELETE CASCADE
 bloqueios_agenda        | ck_bloqueios_janela                       | CHECK ((dia_inteiro OR ((hora_inicio IS NOT NULL) AND (hora_fim IS NOT NULL) AND (hora_fim > hora_inicio))))
(23 rows)

PS D:\WELLIGTON_PROJETOS_DESAFIOS_2026\site-institucional-psicologia> 