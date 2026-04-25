# mercado-pago-consumer

Lambda consumer para trigger SQS da fila `mp-webhook-inbound`.

## Variáveis de ambiente

- `MERCADO_PAGO_CONFIRM_PAYMENT_URL`: URL HTTPS do backend (`/internal/mercadopago/confirm-payment`)
- `MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET`: segredo do header `X-Internal-Webhook-Secret`

## Contrato esperado da mensagem SQS

JSON com os campos abaixo (aceita aliases):

```json
{
  "consulta_id": "550e8400-e29b-41d4-a716-446655440000",
  "payment_id": "12345678901",
  "status": "approved"
}
```

Aliases aceitos:
- `external_reference` no lugar de `consulta_id`
- `id` no lugar de `payment_id`

Mensagens com status diferente de `approved` são ignoradas com sucesso (não reprocessam).
