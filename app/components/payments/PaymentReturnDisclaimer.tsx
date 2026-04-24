export function PaymentReturnDisclaimer() {
  return (
    <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm leading-relaxed text-amber-950">
      <strong className="font-semibold">Importante:</strong> o retorno desta URL não substitui a validação no servidor.
      Quando você está logado, tentamos atualizar sua consulta na hora; o Mercado Pago também envia{" "}
      <strong className="font-semibold">notificações (webhooks)</strong> para o backend confirmar o pagamento.
    </p>
  );
}
