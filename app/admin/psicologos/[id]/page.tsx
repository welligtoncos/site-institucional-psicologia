"use client";

import Link from "next/link";
import { FormEvent, use, useEffect, useState } from "react";


import { AdminGate } from "@/app/components/admin/AdminGate";
import { AvailabilityAdminPanel } from "@/app/components/admin/AvailabilityAdminPanel";
import { adminApiFetch } from "@/app/lib/admin-api";
import { formatApiErrorDetail } from "@/app/lib/portal-errors";

type PsicologoDetail = {
  user: { name: string; email: string; phone: string; is_active: boolean };
  psicologo: {
    id: string;
    crp: string;
    bio: string;
    especialidades: string | null;
    valor_sessao_padrao: string;
    duracao_minutos_padrao: number;
    foto_url: string | null;
  };
};

export default function PsicologoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<PsicologoDetail | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function reload() {
    const res = await adminApiFetch(`/psicologos/${id}`);
    const json = (await res.json()) as PsicologoDetail & { detail?: unknown };
    if (!res.ok) {
      setError(formatApiErrorDetail(json, "Registro não encontrado."));
      setData(null);
      return;
    }
    setData(json);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once id changes
  }, [id]);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setError("");
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      crp: String(fd.get("crp") ?? "").trim(),
      bio: String(fd.get("bio") ?? "").trim(),
      especialidades: String(fd.get("especialidades") ?? "").trim() || null,
      valor_sessao_padrao: Number(String(fd.get("valor_sessao_padrao")).replace(",", ".")),
      duracao_minutos_padrao: Number(fd.get("duracao_minutos_padrao")),
    };
    const res = await adminApiFetch(`/psicologos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(formatApiErrorDetail(json, "Não foi possível salvar."));
      return;
    }
    setData(json as PsicologoDetail);
    setMsg("Alterações salvas.");
  }

  async function toggleActive() {
    setMsg("");
    setError("");
    const next = !(data?.user.is_active ?? false);
    const res = await adminApiFetch(`/psicologos/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: next }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(formatApiErrorDetail(json, "Não foi possível alterar o status."));
      return;
    }
    setData(json as PsicologoDetail);
    setMsg(next ? "Psicólogo ativo no portal do paciente." : "Psicólogo inativo — não aparece no agendamento.");
  }

  if (loading) {
    return (
      <AdminGate>
        <p className="text-sm text-slate-600">Carregando…</p>
      </AdminGate>
    );
  }

  if (!data) {
    return (
      <AdminGate>
        <p className="text-rose-600">{error || "Não encontrado."}</p>
        <Link href="/admin/psicologos" className="mt-4 inline-block text-indigo-700">
          Voltar
        </Link>
      </AdminGate>
    );
  }

  return (
    <AdminGate>
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin/psicologos" className="text-sm font-medium text-indigo-700 hover:underline">
              ← Lista
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">{data.user.name}</h1>
            <p className="text-sm text-slate-600">Perfil clínico e visibilidade no portal.</p>
          </div>
          <button
            type="button"
            onClick={() => toggleActive()}
            className={`rounded-full px-4 py-2 text-sm font-semibold text-white ${
              data.user.is_active ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {data.user.is_active ? "Inativar" : "Ativar"}
          </button>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

        <form onSubmit={onSave} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Nome</span>
            <input name="name" defaultValue={data.user.name} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">E-mail</span>
            <input name="email" type="email" defaultValue={data.user.email} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Telefone</span>
            <input name="phone" defaultValue={data.user.phone} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">CRP</span>
            <input name="crp" defaultValue={data.psicologo.crp} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Especialidades (texto livre)</span>
            <textarea name="especialidades" rows={2} defaultValue={data.psicologo.especialidades ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Bio</span>
            <textarea name="bio" rows={3} defaultValue={data.psicologo.bio} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Valor sessão (R$)</span>
            <input
              name="valor_sessao_padrao"
              defaultValue={data.psicologo.valor_sessao_padrao}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Duração (min)</span>
            <input
              name="duracao_minutos_padrao"
              type="number"
              defaultValue={data.psicologo.duracao_minutos_padrao}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <button type="submit" className="w-full rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
            Salvar alterações
          </button>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <AvailabilityAdminPanel />
        </section>
      </div>
    </AdminGate>
  );
}
