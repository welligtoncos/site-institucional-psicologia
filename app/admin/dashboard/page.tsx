"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminGate } from "@/app/components/admin/AdminGate";
import { adminApiFetch } from "@/app/lib/admin-api";
import { formatApiErrorDetail } from "@/app/lib/portal-errors";

type Indicadores = {
  total_pacientes: number;
  total_psicologos: number;
  total_consultas: number;
  total_pagamentos: number;
  consultas_agendadas: number;
  consultas_canceladas: number;
  pagamentos_pendentes: number;
  pagamentos_confirmados: number;
  faturamento_total_centavos: number;
  ganhos_ultimos_7_dias: { data: string; label: string; valor_centavos: number }[];
  faturamento_mensal_centavos: number;
  ticket_medio_centavos: number;
  novos_pacientes_30_dias: number;
  consultas_realizadas: number;
  no_show: number;
  taxa_comparecimento_percentual: number;
  psicologos_ativos: number;
  pacientes_recorrentes: number;
};

const cards: { key: keyof Indicadores; label: string; href: string }[] = [
  { key: "total_pacientes", label: "Total de pacientes", href: "/admin/pacientes" },
  { key: "total_psicologos", label: "Total de psicólogos", href: "/admin/psicologos" },
  { key: "total_consultas", label: "Total de consultas", href: "/admin/consultas" },
  { key: "total_pagamentos", label: "Total de pagamentos", href: "/admin/pagamentos" },
  { key: "consultas_agendadas", label: "Consultas agendadas", href: "/admin/consultas?status=agendada" },
  { key: "consultas_canceladas", label: "Consultas canceladas", href: "/admin/consultas?status=cancelada" },
  { key: "pagamentos_pendentes", label: "Pagamentos pendentes", href: "/admin/pagamentos?status=awaiting_payment" },
  { key: "pagamentos_confirmados", label: "Pagamentos confirmados", href: "/admin/pagamentos?status=succeeded" },
  { key: "consultas_realizadas", label: "Consultas realizadas", href: "/admin/consultas?status=realizada" },
  { key: "no_show", label: "No-show", href: "/admin/consultas?status=nao_compareceu" },
  { key: "novos_pacientes_30_dias", label: "Novos pacientes (30 dias)", href: "/admin/pacientes" },
  { key: "psicologos_ativos", label: "Psicólogos ativos", href: "/admin/psicologos" },
  { key: "pacientes_recorrentes", label: "Pacientes recorrentes", href: "/admin/pacientes" },
];

function formatCardValue(key: keyof Indicadores, value: Indicadores[keyof Indicadores]) {
  if (typeof value !== "number") return "—";
  if (key === "taxa_comparecimento_percentual") return `${value.toLocaleString("pt-BR")} %`;
  if (key === "faturamento_total_centavos" || key === "faturamento_mensal_centavos" || key === "ticket_medio_centavos") {
    return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return value.toLocaleString("pt-BR");
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Indicadores | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await adminApiFetch("/dashboard/indicadores");
      const json = (await res.json()) as Indicadores & { detail?: unknown };
      if (!res.ok) {
        setError(formatApiErrorDetail(json, "Não foi possível carregar os indicadores."));
        return;
      }
      if (!cancelled) setData(json);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxGain = Math.max(...(data?.ganhos_ultimos_7_dias.map((x) => x.valor_centavos) || [0]), 1);

  return (
    <AdminGate>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Indicadores operacionais da clínica. Clique em um card para abrir a área correspondente.</p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ key, label, href }) => (
            <Link
              key={key}
              href={href}
              className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-indigo-950">
                {data ? formatCardValue(key, data[key]) : "—"}
              </p>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Link
            href="/admin/pagamentos?status=succeeded"
            className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Faturamento total</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-emerald-900">
              {data
                ? (data.faturamento_total_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                : "—"}
            </p>
            <p className="mt-2 text-xs text-slate-500">Somatório de cobranças confirmadas.</p>
          </Link>

          <section className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Ganhos (últimos 7 dias)</h2>
              <span className="text-xs text-slate-500">Base: pagamentos confirmados</span>
            </div>

            <div className="grid grid-cols-7 items-end gap-2">
              {(data?.ganhos_ultimos_7_dias || []).map((item) => {
                const h = Math.max(8, Math.round((item.valor_centavos / maxGain) * 120));
                return (
                  <div key={item.data} className="flex flex-col items-center gap-1">
                    <div className="text-[10px] text-slate-500">
                      {(item.valor_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </div>
                    <div className="w-full rounded-md bg-slate-100 p-1">
                      <div className="w-full rounded bg-indigo-500" style={{ height: `${h}px` }} />
                    </div>
                    <div className="text-[11px] font-medium text-slate-600">{item.label}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Faturamento mensal</p>
            <p className="mt-2 text-2xl font-semibold text-indigo-950">
              {data ? formatCardValue("faturamento_mensal_centavos", data.faturamento_mensal_centavos) : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ticket médio</p>
            <p className="mt-2 text-2xl font-semibold text-indigo-950">
              {data ? formatCardValue("ticket_medio_centavos", data.ticket_medio_centavos) : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Taxa de comparecimento</p>
            <p className="mt-2 text-2xl font-semibold text-indigo-950">
              {data ? formatCardValue("taxa_comparecimento_percentual", data.taxa_comparecimento_percentual) : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pagamentos pendentes</p>
            <p className="mt-2 text-2xl font-semibold text-indigo-950">
              {data ? formatCardValue("pagamentos_pendentes", data.pagamentos_pendentes) : "—"}
            </p>
          </div>
        </div>
      </div>
    </AdminGate>
  );
}
