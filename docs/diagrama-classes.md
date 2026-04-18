# Diagrama de classes — Clínica Harmonia (ERP / persistência)

Modelo lógico em português para derivar tabelas, chaves estrangeiras e APIs. O front atual usa mocks em TypeScript (`MockAppointment`, `SharedLiveSessionState`, etc.); este diagrama representa o **alvo** no banco de dados.

**Arquivo fonte (só Mermaid):** [`diagrama-classes-banco-dados.mmd`](./diagrama-classes-banco-dados.mmd)

## Diagrama principal

```mermaid
classDiagram
  direction TB

  class Usuario {
    +UUID id
    +string email
    +string papel
    +boolean ativo
    +datetime criadoEm
  }

  class Paciente {
    +UUID id
    +UUID usuarioId
    +string nomeCompleto
    +string telefone
    +string contatoEmergencia
    +datetime criadoEm
  }

  class Psicologo {
    +UUID id
    +UUID usuarioId
    +string nomeCompleto
    +string crp
    +string bio
    +decimal valorSessaoPadrao
    +int duracaoMinutosPadrao
    +datetime criadoEm
  }

  class Consulta {
    +UUID id
    +UUID pacienteId
    +UUID psicologoId
    +date dataAgendada
    +string horaInicio
    +int duracaoMinutos
    +string modalidade
    +string status
    +string situacaoPagamento
    +decimal valorAcordado
    +string especialidadeAtendida
    +string linkVideochamadaOpcional
    +string observacoes
    +datetime criadoEm
    +datetime atualizadoEm
  }

  class Cobranca {
    +UUID id
    +UUID consultaId
    +long valorCentavos
    +string moeda
    +string provedorGateway
    +string idIntentGateway
    +string statusGateway
    +datetime criadoEm
    +datetime pagoEm
  }

  class SessaoAoVivo {
    +UUID id
    +UUID consultaId
    +string fase
    +string urlMeet
    +datetime pacienteEntrouEm
    +datetime desbloqueioPlayEm
    +datetime cronometroIniciadoEm
    +datetime encerradaEm
    +datetime atualizadoEm
  }

  class DisponibilidadeSemanal {
    +UUID id
    +UUID psicologoId
    +int diaSemana
    +boolean ativo
    +string horaInicio
    +string horaFim
  }

  class BloqueioAgenda {
    +UUID id
    +UUID psicologoId
    +date dataBloqueio
    +boolean diaInteiro
    +string horaInicio
    +string horaFim
    +string motivo
  }

  Usuario "1" <-- "0..1" Paciente : perfil
  Usuario "1" <-- "0..1" Psicologo : perfil
  Paciente "1" --> "0..*" Consulta : agenda
  Psicologo "1" --> "0..*" Consulta : conduz
  Psicologo "1" --> "0..*" DisponibilidadeSemanal : define
  Psicologo "1" --> "0..*" BloqueioAgenda : registra
  Consulta "1" --> "0..1" Cobranca : gera
  Consulta "1" --> "0..1" SessaoAoVivo : teleatendimento

  note for Consulta "status: agendada, confirmada, em_andamento, realizada, cancelada, nao_compareceu"
  note for Cobranca "statusGateway: aguardando, pago, falhou"
  note for SessaoAoVivo "fase: espera_paciente, ao_vivo, encerrada"
```

## Mapeamento rápido (demo → modelo)

| Mock / front | Classe alvo |
|--------------|-------------|
| `MockAppointment` | `Consulta` |
| `MockPaymentCharge` | `Cobranca` |
| `SharedLiveSessionState` | `SessaoAoVivo` (+ `Consulta`) |
| `PsychologistAgendaAppointment` | `Consulta` (origem agenda) ou visão unificada |

## Diagrama da camada demo (TypeScript)

Detalhe dos tipos atuais no repositório: [`modelagem-classes.mmd`](./modelagem-classes.mmd).
