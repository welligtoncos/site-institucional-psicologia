"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminGate } from "@/app/components/admin/AdminGate";
import { adminApiFetch } from "@/app/lib/admin-api";
import { formatApiErrorDetail } from "@/app/lib/portal-errors";

export default function NovoPsicologoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      password: String(fd.get("password") ?? ""),
      accept_terms: true,
      crp: String(fd.get("crp") ?? "").trim(),
      bio: String(fd.get("bio") ?? "").trim(),
      valor_sessao_padrao: fd.get("valor_sessao_padrao")
        ? Number(String(fd.get("valor_sessao_padrao")).replace(",", "."))
        : null,
      duracao_minutos_padrao: fd.get("duracao_minutos_padrao") ? Number(fd.get("duracao_minutos_padrao")) : null,
    };
    const res = await adminApiFetch("/psicologos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(formatApiErrorDetail(json, "Não foi possível cadastrar."));
      setLoading(false);
      return;
    }
    const id = json?.psicologo?.id as string | undefined;
    router.push(id ? `/admin/psicologos/${id}` : "/admin/psicologos");
  }

  return (
    <AdminGate>
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Novo psicólogo</h1>
          <p className="mt-1 text-sm text-slate-600">Mesmos dados do cadastro público: credenciais e CRP.</p>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Nome</span>
            <input name="name" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">E-mail</span>
            <input name="email" type="email" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Telefone</span>
            <input name="phone" required minLength={8} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Senha inicial</span>
            <input name="password" type="password" required minLength={8} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">CRP</span>
            <input name="crp" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Bio</span>
            <textarea name="bio" rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Valor sessão padrão (R$)</span>
            <input name="valor_sessao_padrao" type="number" step="0.01" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Duração (min)</span>
            <input name="duracao_minutos_padrao" type="number" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Salvando…" : "Cadastrar"}
          </button>
        </form>
      </div>
    </AdminGate>
  );
}
