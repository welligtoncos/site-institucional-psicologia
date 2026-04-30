"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { AdminGate } from "@/app/components/admin/AdminGate";
import { adminApiFetch } from "@/app/lib/admin-api";
import { formatApiErrorDetail } from "@/app/lib/portal-errors";

type Row = {
  id: string;
  paciente_nome: string;
  psicologo_nome: string;
  data_agendada: string;
  hora_inicio: string;
  modalidade: string;
  status_consulta: string;
  status_pagamento_consulta: string;
  status_gateway: string | null;
};

type ListResponse = { items: Row[]; total: number };

function AdminConsultasPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [dateStartFilter, setDateStartFilter] = useState(searchParams.get("data_inicio") ?? "");
  const [dateEndFilter, setDateEndFilter] = useState(searchParams.get("data_fim") ?? "");
  const [patientFilter, setPatientFilter] = useState(searchParams.get("paciente") ?? "");
  const [psychologistFilter, setPsychologistFilter] = useState(searchParams.get("psicologo") ?? "");

  const statusLabel: Record<string, string> = {
    agendada: "Agendada",
    confirmada: "Confirmada",
    em_andamento: "Em andamento",
    realizada: "Realizada",
    cancelada: "Cancelada",
    nao_compareceu: "Não compareceu",
  };

  const gatewayLabel: Record<string, string> = {
    awaiting_payment: "Aguardando pagamento",
    succeeded: "Pagamento aprovado",
    failed: "Pagamento falhou",
  };

  function statusClass(status: string) {
    if (status === "cancelada") return "bg-rose-100 text-rose-800";
    if (status === "confirmada" || status === "realizada") return "bg-emerald-100 text-emerald-800";
    if (status === "em_andamento") return "bg-indigo-100 text-indigo-800";
    return "bg-amber-100 text-amber-900";
  }

  function paymentClass(label: string, gateway: string | null) {
    if (gateway === "succeeded" || label.toLowerCase().includes("pago")) return "bg-emerald-100 text-emerald-800";
    if (gateway === "failed") return "bg-rose-100 text-rose-800";
    return "bg-amber-100 text-amber-900";
  }
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("skip", "0");
    p.set("limit", "100");
    const status = searchParams.get("status");
    const pi = searchParams.get("paciente_id");
    const psi = searchParams.get("psicologo_id");
    const di = searchParams.get("data_inicio");
    const df = searchParams.get("data_fim");
    if (status) p.set("status", status);
    if (pi) p.set("paciente_id", pi);
    if (psi) p.set("psicologo_id", psi);
    if (di) p.set("data_inicio", di);
    if (df) p.set("data_fim", df);
    return p.toString();
  }, [searchParams]);

  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let c = false;
    (async () => {
      const res = await adminApiFetch(`/consultas?${qs}`);
      const json = (await res.json()) as ListResponse & { detail?: unknown };
      if (!res.ok) {
        setError(formatApiErrorDetail(json, "Falha ao listar consultas."));
        setData(null);
        return;
      }
      if (!c) setData(json);
    })();
    return () => {
      c = true;
    };
  }, [qs]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const patientTerm = patientFilter.trim().toLowerCase();
    const psyTerm = psychologistFilter.trim().toLowerCase();
    return data.items.filter((row) => {
      const patientMatch = patientTerm ? row.paciente_nome.toLowerCase().includes(patientTerm) : true;
      const psychologistMatch = psyTerm ? row.psicologo_nome.toLowerCase().includes(psyTerm) : true;
      return patientMatch && psychologistMatch;
    });
  }, [data, patientFilter, psychologistFilter]);

  function applyServerFilters() {
    const p = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      if (value.trim()) p.set(key, value.trim());
      else p.delete(key);
    };
    setOrDelete("status", statusFilter);
    setOrDelete("data_inicio", dateStartFilter);
    setOrDelete("data_fim", dateEndFilter);
    setOrDelete("paciente", patientFilter);
    setOrDelete("psicologo", psychologistFilter);
    p.delete("skip");
    router.replace(`${pathname}?${p.toString()}`);
  }

  function clearFilters() {
    setStatusFilter("");
    setDateStartFilter("");
    setDateEndFilter("");
    setPatientFilter("");
    setPsychologistFilter("");
    router.replace(pathname);
  }

  return (
    <AdminGate>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Consultas</h1>
          <p className="mt-1 text-sm text-slate-600">Visualize, filtre e acesse rapidamente os detalhes das consultas.</p>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm">
              <span className="font-medium text-slate-700">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="">Todos</option>
                <option value="agendada">Agendada</option>
                <option value="confirmada">Confirmada</option>
                <option value="em_andamento">Em andamento</option>
                <option value="realizada">Realizada</option>
                <option value="cancelada">Cancelada</option>
                <option value="nao_compareceu">Não compareceu</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Data inicial</span>
              <input
                type="date"
                value={dateStartFilter}
                onChange={(e) => setDateStartFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Data final</span>
              <input
                type="date"
                value={dateEndFilter}
                onChange={(e) => setDateEndFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Paciente</span>
              <input
                value={patientFilter}
                onChange={(e) => setPatientFilter(e.target.value)}
                placeholder="Nome do paciente"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Psicólogo</span>
              <input
                value={psychologistFilter}
                onChange={(e) => setPsychologistFilter(e.target.value)}
                placeholder="Nome do psicólogo"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyServerFilters()}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={() => clearFilters()}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Limpar
            </button>
          </div>
        </section>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Paciente</th>
                <th className="px-4 py-3">Psicólogo</th>
                <th className="px-4 py-3">Data / hora</th>
                <th className="px-4 py-3">Modalidade</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!data ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    Carregando…
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{row.paciente_nome}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.psicologo_nome}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {new Date(row.data_agendada).toLocaleDateString("pt-BR")} às {row.hora_inicio}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.modalidade}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(row.status_consulta)}`}>
                        {statusLabel[row.status_consulta] || row.status_consulta}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${paymentClass(row.status_pagamento_consulta, row.status_gateway)}`}>
                        {row.status_pagamento_consulta}
                      </span>
                      {row.status_gateway ? (
                        <span className="ml-1 text-slate-500">
                          ({gatewayLabel[row.status_gateway] || row.status_gateway})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/consultas/${row.id}`} className="font-semibold text-indigo-700 hover:underline">
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                ))
              )}
              {data && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    Nenhuma consulta encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {data ? (
          <p className="text-xs text-slate-500">
            Mostrando {filteredRows.length} de {data.items.length} consultas carregadas (total do backend: {data.total}).
          </p>
        ) : null}
      </div>
    </AdminGate>
  );
}

export default function AdminConsultasPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Carregando…</div>}>
      <AdminConsultasPageInner />
    </Suspense>
  );
}
