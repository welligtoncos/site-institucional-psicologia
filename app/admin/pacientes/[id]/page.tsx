"use client";

import Link from "next/link";
import { FormEvent, use, useEffect, useState } from "react";

import { AdminGate } from "@/app/components/admin/AdminGate";
import { adminApiFetch } from "@/app/lib/admin-api";
import { formatApiErrorDetail } from "@/app/lib/portal-errors";

type Detail = {
  paciente: {
    user: { name: string; email: string; phone: string };
    paciente: {
      id: string;
      cpf: string | null;
      contato_emergencia: string | null;
      data_nascimento: string | null;
      cep: string | null;
      logradouro: string | null;
      numero: string | null;
      cidade: string | null;
      uf: string | null;
    };
  };
  consultas_realizadas: { id: string; data_agendada: string; hora_inicio: string; psicologo_nome: string; status: string }[];
  consultas_futuras: { id: string; data_agendada: string; hora_inicio: string; psicologo_nome: string; status: string }[];
  pagamentos: { id: string; valor_centavos: number; status_gateway: string; forma_pagamento: string; criado_em: string }[];
};

export default function PacienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function reload() {
    const res = await adminApiFetch(`/pacientes/${id}`);
    const json = (await res.json()) as Detail & { detail?: unknown };
    if (!res.ok) {
      setError(formatApiErrorDetail(json, "Paciente não encontrado."));
      setData(null);
      return;
    }
    setData(json);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setError("");
    const fd = new FormData(e.currentTarget);
    const cpfRaw = String(fd.get("cpf") ?? "").replace(/\D/g, "");
    const body = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim() || null,
      phone: String(fd.get("phone") ?? "").trim(),
      cpf: cpfRaw.length === 11 ? cpfRaw : String(fd.get("cpf") ?? "").trim(),
      contato_emergencia: String(fd.get("contato_emergencia") ?? "").trim() || null,
      data_nascimento: String(fd.get("data_nascimento") ?? "").trim() || null,
      cep: String(fd.get("cep") ?? "").trim() || null,
      logradouro: String(fd.get("logradouro") ?? "").trim() || null,
      numero: String(fd.get("numero") ?? "").trim() || null,
      cidade: String(fd.get("cidade") ?? "").trim() || null,
      uf: String(fd.get("uf") ?? "").trim().toUpperCase().slice(0, 2) || null,
    };
    const res = await adminApiFetch(`/pacientes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(formatApiErrorDetail(json, "Não foi possível salvar."));
      return;
    }
    setMsg("Dados atualizados.");
    await reload();
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
        <p className="text-rose-600">{error}</p>
        <Link href="/admin/pacientes" className="mt-4 inline-block text-indigo-700">
          Voltar
        </Link>
      </AdminGate>
    );
  }

  const p = data.paciente;

  return (
    <AdminGate>
      <div className="space-y-8">
        <div>
          <Link href="/admin/pacientes" className="text-sm font-medium text-indigo-700 hover:underline">
            ← Lista de pacientes
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{p.user.name}</h1>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Dados cadastrais</h2>
          <form onSubmit={onSave} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Nome</span>
              <input name="name" required defaultValue={p.user.name} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">E-mail</span>
              <input name="email" type="email" defaultValue={p.user.email} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Telefone</span>
              <input name="phone" required defaultValue={p.user.phone} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">CPF</span>
              <input name="cpf" required defaultValue={p.paciente.cpf ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Contato de emergência</span>
              <input name="contato_emergencia" defaultValue={p.paciente.contato_emergencia ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Nascimento</span>
              <input
                name="data_nascimento"
                type="date"
                defaultValue={p.paciente.data_nascimento?.slice(0, 10) ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">CEP</span>
              <input name="cep" defaultValue={p.paciente.cep ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Logradouro</span>
              <input name="logradouro" defaultValue={p.paciente.logradouro ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Número</span>
              <input name="numero" defaultValue={p.paciente.numero ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Cidade / UF</span>
              <div className="mt-1 flex gap-2">
                <input name="cidade" defaultValue={p.paciente.cidade ?? ""} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
                <input name="uf" maxLength={2} defaultValue={p.paciente.uf ?? ""} className="w-20 rounded-xl border border-slate-200 px-3 py-2" />
              </div>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                Salvar cadastro
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Consultas futuras</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {data.consultas_futuras.length === 0 ? <li>—</li> : null}
            {data.consultas_futuras.map((c) => (
              <li key={c.id}>
                {new Date(c.data_agendada).toLocaleDateString("pt-BR")} às {c.hora_inicio} · {c.psicologo_nome} · {c.status}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Consultas realizadas</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {data.consultas_realizadas.length === 0 ? <li>—</li> : null}
            {data.consultas_realizadas.map((c) => (
              <li key={c.id}>
                {new Date(c.data_agendada).toLocaleDateString("pt-BR")} às {c.hora_inicio} · {c.psicologo_nome} · {c.status}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Pagamentos relacionados</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Valor</th>
                  <th className="py-2 pr-4">Forma</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.pagamentos.map((pay) => (
                  <tr key={pay.id}>
                    <td className="py-2 pr-4">{(pay.valor_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td className="py-2 pr-4">{pay.forma_pagamento}</td>
                    <td className="py-2 pr-4">{pay.status_gateway}</td>
                    <td className="py-2">{new Date(pay.criado_em).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminGate>
  );
}
