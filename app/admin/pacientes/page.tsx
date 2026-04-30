"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminGate } from "@/app/components/admin/AdminGate";
import { adminApiFetch } from "@/app/lib/admin-api";
import { formatApiErrorDetail } from "@/app/lib/portal-errors";

type Row = {
  user: { name: string; email: string; phone: string; is_active: boolean; created_at: string };
  paciente: { id: string; criado_em: string };
};

type ListResponse = { items: Row[] };

export default function AdminPacientesPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    (async () => {
      const res = await adminApiFetch("/pacientes?limit=200&skip=0");
      const json = (await res.json()) as ListResponse & { detail?: unknown };
      if (!res.ok) {
        setError(formatApiErrorDetail(json, "Falha ao listar pacientes."));
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
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pacientes</h1>
          <p className="mt-1 text-sm text-slate-600">Cadastros e acesso à ficha com histórico básico de consultas e pagamentos.</p>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Data de cadastro</th>
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
                  <tr key={row.paciente.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.user.name}</td>
                    <td className="px-4 py-3 text-slate-700">{row.user.email}</td>
                    <td className="px-4 py-3 text-slate-700">{row.user.phone || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(row.paciente.criado_em).toLocaleDateString("pt-BR")}
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
                      <Link href={`/admin/pacientes/${row.paciente.id}`} className="text-sm font-semibold text-indigo-700 hover:underline">
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
