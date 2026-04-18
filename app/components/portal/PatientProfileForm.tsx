"use client";

import { FormEvent, useEffect, useState } from "react";

const STORAGE_KEY = "portal_patient_profile_mock_v1";

export type PatientProfileMock = {
  cpf: string;
  birthDate: string;
  zip: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  reference: string;
};

const empty: PatientProfileMock = {
  cpf: "",
  birthDate: "",
  zip: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  reference: "",
};

export function PatientProfileForm() {
  const [data, setData] = useState<PatientProfileMock>(empty);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setData({ ...empty, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 4000);
  }

  function field<K extends keyof PatientProfileMock>(key: K, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Perfil do paciente</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Completar dados</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Informações complementares para cadastro na clínica (mock: os dados ficam apenas no seu navegador até existir
          API).
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Documento e nascimento</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">CPF</span>
              <input
                required
                value={data.cpf}
                onChange={(e) => field("cpf", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                placeholder="000.000.000-00"
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Data de nascimento</span>
              <input
                required
                type="date"
                value={data.birthDate}
                onChange={(e) => field("birthDate", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Endereço</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-slate-700">CEP</span>
              <input
                value={data.zip}
                onChange={(e) => field("zip", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                placeholder="00000-000"
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Rua / Avenida</span>
              <input
                required
                value={data.street}
                onChange={(e) => field("street", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Número</span>
              <input
                value={data.number}
                onChange={(e) => field("number", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Complemento</span>
              <input
                value={data.complement}
                onChange={(e) => field("complement", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                placeholder="Apto, bloco..."
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Bairro</span>
              <input
                value={data.district}
                onChange={(e) => field("district", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Cidade</span>
              <input
                required
                value={data.city}
                onChange={(e) => field("city", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">UF</span>
              <input
                value={data.state}
                onChange={(e) => field("state", e.target.value.toUpperCase().slice(0, 2))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase"
                placeholder="SP"
                maxLength={2}
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Ponto de referência (opcional)</span>
            <textarea
              value={data.reference}
              onChange={(e) => field("reference", e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              placeholder="Próximo a..."
            />
          </label>
        </fieldset>

        {saved ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            Dados salvos localmente (mock). Em produção serão enviados à clínica com segurança.
          </p>
        ) : null}

        <button
          type="submit"
          className="rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
        >
          Salvar perfil
        </button>
      </form>
    </div>
  );
}
