"use client";

import Link from "next/link";
import { FormEvent, use, useEffect, useState } from "react";

import { AdminGate } from "@/app/components/admin/AdminGate";
import { adminApiFetch } from "@/app/lib/admin-api";
import { formatApiErrorDetail } from "@/app/lib/portal-errors";

type Detail = {
  id: string;
  data_agendada: string;
  hora_inicio: string;
  duracao_minutos: number;
  modalidade: string;
  status: string;
  situacao_pagamento: string;
  observacoes: string;
  paciente: { nome: string; email: string };
  psicologo: { nome: string; crp: string };
};

export default function ConsultaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function reload() {
    const res = await adminApiFetch(`/consultas/${id}`);
    const json = (await res.json()) as Detail & { detail?: unknown };
    if (!res.ok) {
      setError(formatApiErrorDetail(json, "Consulta não encontrada."));
      setData(null);
      return;
    }
    setData(json);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function cancelar() {
    setMsg("");
    setError("");
    const res = await adminApiFetch(`/consultas/${id}/cancelar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: "Cancelamento administrativo." }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(formatApiErrorDetail(json, "Não foi possível cancelar."));
      return;
    }
    const notice = (json as { notice?: { notificacoes_enviadas?: boolean; notificacoes_detalhe?: string | null } }).notice;
    setMsg(
      notice?.notificacoes_enviadas
        ? "Consulta cancelada. Paciente e profissional foram notificados por e-mail."
        : `Consulta cancelada. ${notice?.notificacoes_detalhe ?? "E-mail não enviado (configure RESEND no servidor)."}`,
    );
    await reload();
  }

  async function remarcar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setError("");
    const fd = new FormData(e.currentTarget);
    const body = {
      data_agendada: String(fd.get("data_agendada")),
      hora_inicio: String(fd.get("hora_inicio")),
    };
    const res = await adminApiFetch(`/consultas/${id}/remarcar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(formatApiErrorDetail(json, "Não foi possível remarcar."));
      return;
    }
    const notice = (json as { notice?: { notificacoes_enviadas?: boolean; notificacoes_detalhe?: string | null } }).notice;
    setMsg(
      notice?.notificacoes_enviadas
        ? "Consulta remarcada. Notificações enviadas."
        : `Consulta remarcada. ${notice?.notificacoes_detalhe ?? ""}`,
    );
    await reload();
  }

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
        <Link href="/admin/consultas" className="mt-4 inline-block text-indigo-700">
          Voltar
        </Link>
      </AdminGate>
    );
  }

  return (
    <AdminGate>
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <Link href="/admin/consultas" className="text-sm font-medium text-indigo-700 hover:underline">
            ← Lista
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Consulta</h1>
          <p className="text-sm text-slate-600">
            {data.paciente.nome} com {data.psicologo.nome} — {new Date(data.data_agendada).toLocaleDateString("pt-BR")} {data.hora_inicio}
          </p>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {msg ? <p className="text-sm text-emerald-800">{msg}</p> : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
          <p>
            <span className="font-semibold text-slate-700">Status:</span> {data.status}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-700">Pagamento (consulta):</span> {data.situacao_pagamento}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-700">Modalidade:</span> {data.modalidade}
          </p>
          {data.observacoes ? (
            <p className="mt-3 whitespace-pre-wrap text-slate-600">
              <span className="font-semibold text-slate-700">Observações:</span> {data.observacoes}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => cancelar()}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Cancelar consulta
          </button>
        </div>

        <form onSubmit={remarcar} className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
          <h2 className="text-sm font-semibold text-indigo-950">Remarcar</h2>
          <label className="block text-sm">
            <span className="text-slate-700">Nova data</span>
            <input name="data_agendada" type="date" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Novo horário (HH:MM)</span>
            <input name="hora_inicio" required placeholder="14:30" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <button type="submit" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Remarcar e notificar
          </button>
        </form>
      </div>
    </AdminGate>
  );
}
