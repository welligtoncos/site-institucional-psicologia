# Teste de Processamento de Pagamento em Massa

Este guia descreve como validar, em ambiente semelhante ao de producao, o fluxo:

1. webhook/lambda de entrada identifica pagamento aprovado;
2. mensagem vai para a fila `mp-webhook-inbound` (SQS);
3. lambda `mercado-pago-consumer` consome a fila;
4. backend recebe `POST /internal/mercadopago/confirm-payment`;
5. cobranca/consulta sao atualizadas no PostgreSQL.

## Objetivo do teste

Confirmar que multiplos pagamentos em paralelo sao processados sem perda, com suporte a reprocessamento em caso de falha temporaria.

## Pre-requisitos

- API no ar e acessivel na URL usada por `MERCADO_PAGO_CONFIRM_PAYMENT_URL`.
- Lambda `mercado-pago-consumer` ativa e com trigger SQS habilitado.
- Fila principal `mp-webhook-inbound` e DLQ configuradas.
- Credenciais AWS com permissao `sqs:SendMessage` na fila.
- 4 a 10 consultas com cobranca pendente (`status_gateway = awaiting_payment`).

## 1) Buscar `consulta_id` validos (pendentes)

```bash
docker-compose exec db psql --username=app --dbname=appdb -c "
SELECT
  c.id AS consulta_id,
  c.status,
  c.situacao_pagamento,
  cb.status_gateway,
  c.criado_em
FROM consultas c
JOIN cobrancas cb ON cb.consulta_id = c.id
WHERE cb.status_gateway = 'awaiting_payment'
ORDER BY c.criado_em DESC NULLS LAST
LIMIT 10;
"
```

Copie os UUIDs da coluna `consulta_id`.

## 2) Envio paralelo para SQS (carga simples)

Substitua os UUIDs abaixo pelos IDs reais.

```bash
QUEUE_URL="https://sqs.us-east-1.amazonaws.com/303238378103/mp-webhook-inbound"

aws sqs send-message --region us-east-1 --output json --queue-url "$QUEUE_URL" --message-body '{"consulta_id":"UUID1","payment_id":"stress-001","status":"approved","source":"stress-test"}' &
aws sqs send-message --region us-east-1 --output json --queue-url "$QUEUE_URL" --message-body '{"consulta_id":"UUID2","payment_id":"stress-002","status":"approved","source":"stress-test"}' &
aws sqs send-message --region us-east-1 --output json --queue-url "$QUEUE_URL" --message-body '{"consulta_id":"UUID3","payment_id":"stress-003","status":"approved","source":"stress-test"}' &
aws sqs send-message --region us-east-1 --output json --queue-url "$QUEUE_URL" --message-body '{"consulta_id":"UUID4","payment_id":"stress-004","status":"approved","source":"stress-test"}' &
wait
echo "mensagens enviadas"
```

## 3) Evidencias de sucesso (obrigatorias)

### 3.1 Backend (docker logs)

Esperado: chamadas para `POST /internal/mercadopago/confirm-payment` com `200 OK`.

```bash
docker logs -f <container_api>
```

### 3.2 Lambda consumer (CloudWatch)

Esperado: sem erro para as mensagens do lote, com logs de confirmacao no backend.

Grupo de logs: `/aws/lambda/mercado-pago-consumer`.

### 3.3 Banco PostgreSQL (estado final)

```bash
docker-compose exec db psql --username=app --dbname=appdb -c "
SELECT
  c.id,
  cb.status_gateway,
  c.situacao_pagamento,
  cb.pago_em
FROM consultas c
JOIN cobrancas cb ON cb.consulta_id = c.id
WHERE c.id IN ('UUID1','UUID2','UUID3','UUID4');
"
```

Esperado:
- `status_gateway = succeeded`
- `situacao_pagamento = pago`
- `pago_em` preenchido

### 3.4 DLQ

Esperado: sem novas mensagens na DLQ durante teste de sucesso.

## 4) Teste de resiliencia (opcional, recomendado)

1. Envie lote para a SQS.
2. Derrube temporariamente a API.
3. Verifique falha no consumer (CloudWatch) e reentrega pela SQS.
4. Suba a API novamente.
5. Verifique processamento bem-sucedido na tentativa seguinte.

Isso valida reprocessamento sem perda.

## Troubleshooting

### `422 Unprocessable Entity` em `/internal/mercadopago/confirm-payment`

- Causa comum: `consulta_id` invalido (placeholder em vez de UUID real).
- Acao: reenviar com UUID existente da tabela `consultas`.

### `AccessDenied` no `aws sqs send-message`

- Falta permissao IAM `sqs:SendMessage` para a fila.
- Ajustar policy do usuario/role.

### `Unknown output type: east-1` na AWS CLI

- Configuracao da CLI invalida.
- Use flags `--region us-east-1 --output json` e corrija:
  - `aws configure set default.region us-east-1`
  - `aws configure set default.output json`

## Criterio de aprovacao

Teste considerado aprovado quando:

- 100% das mensagens enviadas sao confirmadas com `200` no endpoint interno;
- 100% das consultas do lote ficam com pagamento atualizado no banco;
- 0 mensagens na DLQ para o cenario de sucesso;
- no cenario de resiliencia, mensagens falhas sao reprocessadas apos retorno da API.
