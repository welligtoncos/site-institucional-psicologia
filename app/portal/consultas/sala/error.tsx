"use client";

import Link from "next/link";

type PortalConsultasSalaErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PortalConsultasSalaError({ reset }: PortalConsultasSalaErrorProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
      <p className="text-sm font-semibold text-rose-900">Nao foi possivel carregar a sala de atendimento.</p>
      <p className="text-xs text-rose-800">
        Tente recarregar a sala. Se o problema continuar, volte para Minhas consultas e entre novamente.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        >
          Recarregar sala
        </button>
        <Link
          href="/portal/consultas"
          className="inline-flex rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100"
        >
          Voltar para Minhas consultas
        </Link>
      </div>
    </div>
  );
}
