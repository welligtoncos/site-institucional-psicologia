# Clinica Harmonia - Site Institucional

Projeto em Next.js (App Router) para site de clinica de psicologia, com fluxo profissional de
"Solicitar agendamento" via formulario + Server Action + envio de e-mail com Resend.
O sistema agora possui backend simples para disponibilidade progressiva de horarios.

## Requisitos

- Node.js 20+
- Conta no [Resend](https://resend.com/)

## Como executar

1. Instale dependencias:

```bash
npm install
```

2. Crie o arquivo `.env.local` com base em `.env.example`:

```bash
# PowerShell (Windows)
Copy-Item .env.example .env.local
```

3. Configure as variaveis:

- `RESEND_API_KEY`: chave da API Resend
- `RESEND_FROM_EMAIL`: remetente autorizado no Resend
- `CLINIC_CONTACT_EMAIL`: e-mail que recebera os agendamentos
- `ADMIN_API_TOKEN`: token para endpoints administrativos de disponibilidade
- `AVAILABILITY_DAYS_AHEAD`: quantidade de dias futuros gerados automaticamente

4. Rode o projeto:

```bash
npm run dev
```

5. Acesse:

[http://localhost:3000](http://localhost:3000)

## Estrutura da funcionalidade de agendamento

```text
app/
  contato/
    actions.ts                  # Server Action (validacao + envio via Resend)
    form-state.ts               # tipos e estado inicial do formulario
    page.tsx                    # pagina de contato
  api/
    availability/route.ts       # endpoint publico de disponibilidade
    admin/availability/route.ts # endpoint admin para bloquear/liberar horarios
  components/
    forms/
      AppointmentRequestForm.tsx # formulario client-side com feedback
  lib/
    availability.ts             # tipos e slots base
    server/
      availability-store.ts     # persistencia e regras de disponibilidade
    validations/
      appointment.ts            # schema Zod
    email/
      appointment-email-template.ts # template HTML/text do e-mail
```

## Backend de disponibilidade (admin)

A disponibilidade e gerada automaticamente de forma progressiva para os proximos dias. Por padrao,
todos os horarios iniciam **indisponiveis** (nenhum selecionado). O admin **marca** os horarios que
ficam disponiveis para agendamento.

Somente overrides (horarios liberados) sao persistidos em:

`data/availability-overrides.json`

### Endpoints

- `GET /api/availability` (publico)
- `GET /api/admin/availability` (admin)
- `PATCH /api/admin/availability` (admin)

Exemplo de **liberar** um horario para agendamento (PowerShell):

```powershell
$headers = @{
  "x-admin-token" = "seu-token-admin"
  "Content-Type" = "application/json"
}

$body = @{
  date = "2026-04-20"
  time = "09:30"
  status = "available"
} | ConvertTo-Json

Invoke-RestMethod -Method Patch -Uri "http://localhost:3000/api/admin/availability" -Headers $headers -Body $body
```

## Tela admin interna

Voce tambem pode usar a interface interna:

- `http://localhost:3000/admin/agenda`

Fluxo:

1. Abrir a tela
2. Informar o token `ADMIN_API_TOKEN`
3. Carregar disponibilidade
4. Clicar nos horarios para **marcar como disponivel** ou **desmarcar** (volta ao padrao indisponivel)

## Boas praticas aplicadas

- Validacao robusta com `zod`
- Server Action no servidor (`"use server"`)
- Feedback de sucesso/erro no frontend
- Campo honeypot + validacao de tempo minimo de envio (anti-bot)
- Uso de variaveis de ambiente para credenciais e destinos
- Estrutura modular para evolucao futura (escalabilidade)
