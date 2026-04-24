export function PaymentReturnDisclaimer() {
  return (
    <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm leading-relaxed text-amber-950">
      <strong className="font-semibold">Importante:</strong> esta página reflete apenas o retorno do checkout. A
      confirmação definitiva do pagamento deve ser feita depois via{" "}
      <strong className="font-semibold">webhooks / notificações IPN</strong> do Mercado Pago. As URLs de retorno
      melhoram a experiência do usuário, mas não substituem essa validação no servidor.
    </p>
  );
}
