-- =============================================================================
-- Dados de teste + consultas de validação (modelagem docs/schema-fisico-postgresql.sql)
-- Pré-requisito: Alembic head + schema físico aplicados no mesmo banco (ex.: appdb_test)
--
-- Executar (PowerShell, raiz do repo):
--   Get-Content -Raw .\docs\queries-teste-modelagem.sql |
--     docker compose -f .\app_backend\docker-compose.yml exec -T db psql -U app -d appdb_test -v ON_ERROR_STOP=1
-- =============================================================================

BEGIN;

-- Limpeza: remove só estes e-mails de teste (respeita FKs)
DELETE FROM cobrancas c
USING consultas co
WHERE c.consulta_id = co.id
  AND co.paciente_id IN (SELECT p.id FROM pacientes p JOIN users u ON u.id = p.usuario_id WHERE u.email IN ('paciente@teste.modelagem', 'psicologo@teste.modelagem'));

DELETE FROM sessoes_ao_vivo s
USING consultas co
WHERE s.consulta_id = co.id
  AND co.paciente_id IN (SELECT p.id FROM pacientes p JOIN users u ON u.id = p.usuario_id WHERE u.email IN ('paciente@teste.modelagem', 'psicologo@teste.modelagem'));

DELETE FROM consultas co
WHERE co.paciente_id IN (SELECT p.id FROM pacientes p JOIN users u ON u.id = p.usuario_id WHERE u.email IN ('paciente@teste.modelagem', 'psicologo@teste.modelagem'));

DELETE FROM bloqueios_agenda b
WHERE b.psicologo_id IN (SELECT ps.id FROM psicologos ps JOIN users u ON u.id = ps.usuario_id WHERE u.email = 'psicologo@teste.modelagem');

DELETE FROM disponibilidade_semanal d
WHERE d.psicologo_id IN (SELECT ps.id FROM psicologos ps JOIN users u ON u.id = ps.usuario_id WHERE u.email = 'psicologo@teste.modelagem');

DELETE FROM pacientes p
USING users u
WHERE p.usuario_id = u.id AND u.email = 'paciente@teste.modelagem';

DELETE FROM psicologos ps
USING users u
WHERE ps.usuario_id = u.id AND u.email = 'psicologo@teste.modelagem';

DELETE FROM users WHERE email IN ('paciente@teste.modelagem', 'psicologo@teste.modelagem');

-- Usuários base (enum user_role_enum: patient | psychologist | admin)
INSERT INTO users (id, name, email, phone, password_hash, role, is_active)
VALUES
  (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Paciente Teste',
    'paciente@teste.modelagem',
    '11999990001',
    '$2b$12$dummyhashapenasparabancodetesteNAOusarproducao',
    'patient',
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222'::uuid,
    'Psicólogo Teste',
    'psicologo@teste.modelagem',
    '11999990002',
    '$2b$12$dummyhashapenasparabancodetesteNAOusarproducao',
    'psychologist',
    true
  );

INSERT INTO pacientes (id, usuario_id, contato_emergencia)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Familiar: 11888880000'
);

INSERT INTO psicologos (id, usuario_id, crp, bio, valor_sessao_padrao, duracao_minutos_padrao)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '06/123456-SP',
  'Atendimento clínico de teste.',
  180.00,
  50
);

-- Disponibilidade: segunda (1) 08–12
INSERT INTO disponibilidade_semanal (id, psicologo_id, dia_semana, ativo, hora_inicio, hora_fim)
VALUES (
  gen_random_uuid(),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  1,
  true,
  '08:00',
  '12:00'
);

-- Bloqueio: dia inteiro em data futura fixa
INSERT INTO bloqueios_agenda (id, psicologo_id, data_bloqueio, dia_inteiro, motivo)
VALUES (
  gen_random_uuid(),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  CURRENT_DATE + 30,
  true,
  'Feriado local (teste)'
);

INSERT INTO consultas (
  id,
  paciente_id,
  psicologo_id,
  data_agendada,
  hora_inicio,
  duracao_minutos,
  modalidade,
  status,
  situacao_pagamento,
  valor_acordado,
  especialidade_atendida,
  link_videochamada_opcional,
  observacoes
)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  CURRENT_DATE + 7,
  '10:00',
  50,
  'Online',
  'confirmada',
  'Pendente',
  180.00,
  'Ansiedade',
  'https://meet.example.com/abc-def-ghi',
  'Primeira sessão (teste)'
);

INSERT INTO cobrancas (
  id,
  consulta_id,
  valor_centavos,
  moeda,
  provedor_gateway,
  id_intent_gateway,
  status_gateway
)
VALUES (
  gen_random_uuid(),
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  18000,
  'BRL',
  'stripe_compatible_mock',
  'pi_test_intent_' || substr(md5(random()::text), 1, 16),
  'awaiting_payment'
);

INSERT INTO sessoes_ao_vivo (id, consulta_id, fase, url_meet)
VALUES (
  gen_random_uuid(),
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  'patient_waiting',
  'https://meet.example.com/abc-def-ghi'
);

COMMIT;

-- =============================================================================
-- Consultas de leitura (validação)
-- =============================================================================

-- Visão agregada: consulta + paciente + psicólogo + cobrança + sessão
SELECT
  c.id AS consulta_id,
  c.data_agendada,
  c.hora_inicio,
  c.status,
  c.modalidade,
  up.name AS paciente_nome,
  ups.name AS psicologo_nome,
  ps.crp,
  cb.valor_centavos,
  cb.status_gateway,
  sv.fase AS sessao_fase
FROM consultas c
JOIN pacientes p ON p.id = c.paciente_id
JOIN users up ON up.id = p.usuario_id
JOIN psicologos ps ON ps.id = c.psicologo_id
JOIN users ups ON ups.id = ps.usuario_id
LEFT JOIN cobrancas cb ON cb.consulta_id = c.id
LEFT JOIN sessoes_ao_vivo sv ON sv.consulta_id = c.id
WHERE up.email = 'paciente@teste.modelagem';

-- Enum / integridade: listar tipos criados pelo schema físico
SELECT typname
FROM pg_type
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND typtype = 'e'
  AND typname IN (
    'consulta_status',
    'consulta_modalidade',
    'consulta_situacao_pagamento',
    'cobranca_status_gateway',
    'sessao_ao_vivo_fase'
  )
ORDER BY typname;
