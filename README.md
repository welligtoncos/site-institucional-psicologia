# Clinica Harmonia - Site Institucional

Projeto em Next.js (App Router) para site de clinica de psicologia, com fluxo profissional de
"Solicitar agendamento" via formulario + Server Action + envio de e-mail com Resend.

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
  components/
    forms/
      AppointmentRequestForm.tsx # formulario client-side com feedback
  lib/
    validations/
      appointment.ts            # schema Zod
    email/
      appointment-email-template.ts # template HTML/text do e-mail
```

## Boas praticas aplicadas

- Validacao robusta com `zod`
- Server Action no servidor (`"use server"`)
- Feedback de sucesso/erro no frontend
- Campo honeypot + validacao de tempo minimo de envio (anti-bot)
- Uso de variaveis de ambiente para credenciais e destinos
- Estrutura modular para evolucao futura (escalabilidade)
