-- =============================================================================
-- Modelagem física — PostgreSQL (clínica / ERP)
-- Alinhado a: docs/diagrama-classes-banco-dados.mmd
-- Pré-requisito: tabela public.users (Alembic 001–004) com enum user_role_enum
-- Execução: psql -f docs/schema-fisico-postgresql.sql  OU  cliente SQL
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Tipos enumerados (domínio)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE consulta_status AS ENUM (
    'agendada',
    'confirmada',
    'em_andamento',
    'realizada',
    'cancelada',
    'nao_compareceu'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  CREATE TYPE consulta_modalidade AS ENUM ('Online', 'Presencial');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  CREATE TYPE consulta_situacao_pagamento AS ENUM ('Pago', 'Pendente');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  CREATE TYPE cobranca_status_gateway AS ENUM (
    'awaiting_payment',
    'succeeded',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  CREATE TYPE sessao_ao_vivo_fase AS ENUM (
    'patient_waiting',
    'live',
    'ended'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

-- ---------------------------------------------------------------------------
-- Paciente (perfil 1:1 com users — RF-001 / portal)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  contato_emergencia TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE pacientes IS 'Perfil clínico do paciente; nome/e-mail/telefone em users.';
COMMENT ON COLUMN pacientes.usuario_id IS 'FK 1:1 com users; role esperado: patient.';

CREATE INDEX IF NOT EXISTS ix_pacientes_usuario_id ON pacientes (usuario_id);

-- ---------------------------------------------------------------------------
-- Psicólogo (perfil 1:1 com users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS psicologos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  crp VARCHAR(32) NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  valor_sessao_padrao NUMERIC(12, 2) NOT NULL DEFAULT 0,
  duracao_minutos_padrao SMALLINT NOT NULL DEFAULT 50,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE psicologos IS 'Perfil profissional; role esperado: psychologist em users.';
CREATE INDEX IF NOT EXISTS ix_psicologos_usuario_id ON psicologos (usuario_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_psicologos_crp ON psicologos (crp);

-- ---------------------------------------------------------------------------
-- Consulta
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consultas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES pacientes (id) ON DELETE RESTRICT,
  psicologo_id UUID NOT NULL REFERENCES psicologos (id) ON DELETE RESTRICT,
  data_agendada DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  duracao_minutos SMALLINT NOT NULL DEFAULT 50,
  modalidade consulta_modalidade NOT NULL,
  status consulta_status NOT NULL DEFAULT 'agendada',
  situacao_pagamento consulta_situacao_pagamento NOT NULL DEFAULT 'Pendente',
  valor_acordado NUMERIC(12, 2) NOT NULL,
  especialidade_atendida VARCHAR(120) NOT NULL DEFAULT '',
  link_videochamada_opcional TEXT,
  observacoes TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE consultas IS 'Agendamento; status e pagamento alinhados ao portal mock.';

CREATE INDEX IF NOT EXISTS ix_consultas_paciente_data ON consultas (paciente_id, data_agendada);
CREATE INDEX IF NOT EXISTS ix_consultas_psicologo_data ON consultas (psicologo_id, data_agendada);
CREATE INDEX IF NOT EXISTS ix_consultas_status ON consultas (status);

-- Evita dois agendamentos no mesmo slot para o mesmo psicólogo (ajuste se a clínica permitir sala paralela)
CREATE UNIQUE INDEX IF NOT EXISTS uq_consultas_psicologo_inicio
  ON consultas (psicologo_id, data_agendada, hora_inicio)
  WHERE status NOT IN ('cancelada', 'nao_compareceu');

-- ---------------------------------------------------------------------------
-- Cobrança (RF-009 / RF-010)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id UUID NOT NULL UNIQUE REFERENCES consultas (id) ON DELETE RESTRICT,
  valor_centavos BIGINT NOT NULL CHECK (valor_centavos >= 0),
  moeda CHAR(3) NOT NULL DEFAULT 'BRL',
  provedor_gateway VARCHAR(64) NOT NULL DEFAULT 'stripe_compatible_mock',
  id_intent_gateway VARCHAR(128) NOT NULL,
  status_gateway cobranca_status_gateway NOT NULL DEFAULT 'awaiting_payment',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  pago_em TIMESTAMPTZ
);

COMMENT ON TABLE cobrancas IS 'Uma cobrança ativa por consulta (1:1); intent id para gateway.';
CREATE INDEX IF NOT EXISTS ix_cobrancas_status ON cobrancas (status_gateway);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cobrancas_intent ON cobrancas (id_intent_gateway);

-- ---------------------------------------------------------------------------
-- Sessão ao vivo (persistência do fluxo Meet + cronômetro)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessoes_ao_vivo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id UUID NOT NULL UNIQUE REFERENCES consultas (id) ON DELETE CASCADE,
  fase sessao_ao_vivo_fase NOT NULL DEFAULT 'patient_waiting',
  url_meet TEXT,
  paciente_entrou_em TIMESTAMPTZ,
  desbloqueio_play_em TIMESTAMPTZ,
  cronometro_iniciado_em TIMESTAMPTZ,
  encerrada_em TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sessoes_ao_vivo IS 'Estado da teleconsulta; fases alinhadas ao front (live-session-shared).';
CREATE INDEX IF NOT EXISTS ix_sessoes_fase ON sessoes_ao_vivo (fase);

-- ---------------------------------------------------------------------------
-- Disponibilidade semanal do psicólogo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disponibilidade_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id UUID NOT NULL REFERENCES psicologos (id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  ativo BOOLEAN NOT NULL DEFAULT true,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  CONSTRAINT ck_disponibilidade_janela CHECK (hora_fim > hora_inicio)
);

CREATE INDEX IF NOT EXISTS ix_disponibilidade_psicologo_dia
  ON disponibilidade_semanal (psicologo_id, dia_semana);

-- ---------------------------------------------------------------------------
-- Bloqueios de agenda
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bloqueios_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id UUID NOT NULL REFERENCES psicologos (id) ON DELETE CASCADE,
  data_bloqueio DATE NOT NULL,
  dia_inteiro BOOLEAN NOT NULL DEFAULT true,
  hora_inicio TIME,
  hora_fim TIME,
  motivo TEXT NOT NULL DEFAULT '',
  CONSTRAINT ck_bloqueios_janela CHECK (
    dia_inteiro
    OR (
      hora_inicio IS NOT NULL
      AND hora_fim IS NOT NULL
      AND hora_fim > hora_inicio
    )
  )
);

CREATE INDEX IF NOT EXISTS ix_bloqueios_psicologo_data ON bloqueios_agenda (psicologo_id, data_bloqueio);

COMMIT;

-- =============================================================================
-- Gatilho opcional: atualizar atualizado_em em consultas (descomente se usar)
-- =============================================================================
-- CREATE OR REPLACE FUNCTION trg_set_consultas_atualizado_em()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.atualizado_em := now();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- CREATE TRIGGER consultas_touch BEFORE UPDATE ON consultas
-- FOR EACH ROW EXECUTE FUNCTION trg_set_consultas_atualizado_em();
