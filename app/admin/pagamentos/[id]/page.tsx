"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { AdminGate } from "@/app/components/admin/AdminGate";
import { adminApiFetch } from "@/app/lib/admin-api";
import { formatApiErrorDetail } from "@/app/lib/portal-errors";

type Detail = {
  cobranca_id: string;
  consulta_id: string;
  valor_centavos: number;
  moeda: string;
  forma_pagamento: string;
  provedor_gateway: string;
  id_intent_gateway: string;
  status_gateway: string;
  criado_em: string;
  pago_em: string | null;
  paciente: { nome: string; email: string };
  consulta_resumo: { data: string; hora: string; status: string; modalidade: string };
};

export default function PagamentoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let c = false;
    (async () => {
      const res = await adminApiFetch(`/pagamentos/${id}`);
      const json = (await res.json()) as Detail & { detail?: unknown };
      if (!res.ok) {
        setError(formatApiErrorDetail(json, "Cobrança não encontrada."));
        setData(null);
        return;
      }
      if (!c) setData(json);
    })();
    return () => {
      c = true;
    };
  }, [id]);

  if (!data && !error) {
    return (
      <AdminGate>
        <p className="text-sm text-slate-600">Carregando…</p>
      </AdminGate>
    );
  }

  if (!data) {
    return (
      <AdminGate>
        <p className="text-rose-600">{error}</p>
        <Link href="/admin/pagamentos" className="mt-4 inline-block text-indigo-700">
          Voltar
        </Link>
      </AdminGate>
    );
  }

  return (
    <AdminGate>
      <div className="mx-auto max-w-xl space-y-4">
        <Link href="/admin/pagamentos" className="text-sm font-medium text-indigo-700 hover:underline">
          ← Lista de pagamentos
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Cobrança</h1>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
          <p>
            <span className="font-semibold text-slate-700">Valor:</span>{" "}
            {(data.valor_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: data.moeda || "BRL" })}
          </p>
          <p className="mt-2">
            <span className="font-semibold text-slate-700">Status (gateway):</span> {data.status_gateway}
          </p>
          <p className="mt-2">
            <span className="font-semibold text-slate-700">Forma:</span> {data.forma_pagamento} ({data.provedor_gateway})
          </p>
          <p className="mt-2 font-mono text-xs text-slate-600">
            Intent/ref: {data.id_intent_gateway}
          </p>
          <p className="mt-2">
            <span className="font-semibold text-slate-700">Criado em:</span> {new Date(data.criado_em).toLocaleString("pt-BR")}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-700">Pago em:</span>{" "}
            {data.pago_em ? new Date(data.pago_em).toLocaleString("pt-BR") : "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
          <h2 className="font-semibold text-slate-900">Paciente</h2>
          <p className="mt-2">{data.paciente.nome}</p>
          <p className="text-slate-600">{data.paciente.email}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
          <h2 className="font-semibold text-slate-900">Consulta relacionada</h2>
          <p className="mt-2">
            {data.consulta_resumo.data} às {data.consulta_resumo.hora} · {data.consulta_resumo.modalidade}
          </p>
          <p className="text-slate-600">Status da consulta: {data.consulta_resumo.status}</p>
          <Link href={`/admin/consultas/${data.consulta_id}`} className="mt-3 inline-block text-indigo-700 hover:underline">
            Abrir consulta
          </Link>
        </div>
      </div>
    </AdminGate>
  );
}
