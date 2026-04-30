"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminGate } from "@/app/components/admin/AdminGate";
import { adminApiFetch } from "@/app/lib/admin-api";
import { formatApiErrorDetail } from "@/app/lib/portal-errors";

type Item = {
  user: { name: string; email: string; is_active: boolean; phone: string };
  psicologo: { id: string; crp: string; especialidades: string | null };
  professional_profile_complete: boolean;
};

type ListResponse = { items: Item[] };

export default function AdminPsicologosPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    (async () => {
      const res = await adminApiFetch("/psicologos?limit=200&skip=0");
      const json = (await res.json()) as ListResponse & { detail?: unknown };
      if (!res.ok) {
        setError(formatApiErrorDetail(json, "Falha ao listar psicólogos."));
        setLoading(false);
        return;
      }
      if (!c) {
        setItems(json.items);
        setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <AdminGate>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Psicólogos</h1>
            <p className="mt-1 text-sm text-slate-600">Profissionais ativos no sistema e visíveis no portal do paciente quando a conta estiver ativa.</p>
          </div>
          <Link
            href="/admin/psicologos/novo"
            className="inline-flex rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Novo psicólogo
          </Link>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">CRP</th>
                <th className="px-4 py-3">Especialidade</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Carregando…
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.psicologo.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.user.name}</td>
                    <td className="px-4 py-3 text-slate-700">{row.user.email}</td>
                    <td className="px-4 py-3 text-slate-700">{row.psicologo.crp}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-600" title={row.psicologo.especialidades ?? ""}>
                      {row.psicologo.especialidades?.replace(/\|/g, ", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          row.user.is_active ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {row.user.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/psicologos/${row.psicologo.id}`} className="text-sm font-semibold text-indigo-700 hover:underline">
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminGate>
  );
}
