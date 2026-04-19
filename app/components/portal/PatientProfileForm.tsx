"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

const ACCESS_TOKEN_KEY = "portal_access_token";

export type PatientProfileFormState = {
  name: string;
  phone: string;
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
  emergencyContact: string;
};

const empty: PatientProfileFormState = {
  name: "",
  phone: "",
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
  emergencyContact: "",
};

function formatCpfDisplay(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return raw.trim();
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Nome, telefone (mín. 8 dígitos) e CPF válido — alinhado ao PATCH do backend. */
function isRequiredProfileComplete(d: PatientProfileFormState): boolean {
  if (!d.name.trim()) return false;
  const phoneDigits = d.phone.replace(/\D/g, "");
  if (phoneDigits.length < 8) return false;
  if (d.cpf.replace(/\D/g, "").length !== 11) return false;
  return true;
}

function formatApiErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: string }).msg);
        }
        return JSON.stringify(item);
      })
      .join(" ");
  }
  return "Não foi possível concluir a operação.";
}

/** Contraste explícito: evita texto herdado claro sobre fundo branco nos inputs. */
const fieldClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-inner shadow-slate-900/5 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25 [color-scheme:light]";

function ProfileAttentionBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="relative overflow-hidden rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100/90 p-4 shadow-lg shadow-amber-900/10 ring-2 ring-amber-300/60"
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-400/20 blur-2xl" />
      <div className="relative flex gap-3 sm:gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-lg font-bold text-white shadow-md ring-2 ring-amber-600/30"
          aria-hidden
        >
          !
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm font-bold uppercase tracking-wide text-amber-950">Atenção — cadastro pendente</p>
          <p className="mt-1.5 text-sm leading-relaxed text-amber-950/95">{message}</p>
        </div>
      </div>
    </div>
  );
}

type ProfilePatientJson = {
  detail?: string;
  user?: {
    name: string;
    phone: string;
    email: string;
  };
  paciente?: {
    contato_emergencia: string | null;
    cpf: string | null;
    data_nascimento: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    ponto_referencia: string | null;
  };
};

export function PatientProfileForm() {
  const [data, setData] = useState<PatientProfileFormState>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attentionMessage, setAttentionMessage] = useState<string | null>(null);
  /** "Meu perfil" só após carregar dados já completos do servidor ou após salvar com sucesso — não ao digitar. */
  const [headerShowsComplete, setHeaderShowsComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMeForNamePhone(token: string) {
      const r = await fetch("/api/portal/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const me = (await r.json()) as { name?: string; phone?: string };
      if (!r.ok || cancelled) return;
      setData((prev) => ({
        ...prev,
        name: typeof me.name === "string" ? me.name : prev.name,
        phone: typeof me.phone === "string" ? me.phone : prev.phone,
      }));
    }

    async function load() {
      const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!token) {
        setLoading(false);
        toast.error("Sessão expirada. Entre novamente.");
        return;
      }
      try {
        const response = await fetch("/api/portal/profile/patient", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await response.json()) as ProfilePatientJson;

        if (response.status === 404) {
          const detail =
            typeof json.detail === "string"
              ? json.detail
              : "Seu cadastro como paciente ainda não foi concluído. Preencha o formulário abaixo e salve, ou fale com o suporte da clínica.";
          if (!cancelled) {
            setHeaderShowsComplete(false);
            setAttentionMessage(detail);
            await loadMeForNamePhone(token);
          }
          return;
        }
        if (!response.ok) {
          throw new Error(formatApiErrorDetail(json.detail) || "Não foi possível carregar seu perfil.");
        }
        if (cancelled || !json.paciente) return;

        const p = json.paciente;
        const u = json.user;
        const next: PatientProfileFormState = {
          name: u?.name?.trim() ?? "",
          phone: u?.phone?.trim() ?? "",
          cpf: p.cpf ? formatCpfDisplay(p.cpf) : "",
          birthDate: p.data_nascimento ? p.data_nascimento.slice(0, 10) : "",
          zip: p.cep ?? "",
          street: p.logradouro ?? "",
          number: p.numero ?? "",
          complement: p.complemento ?? "",
          district: p.bairro ?? "",
          city: p.cidade ?? "",
          state: p.uf ?? "",
          reference: p.ponto_referencia ?? "",
          emergencyContact: p.contato_emergencia ?? "",
        };
        setData(next);
        if (!cancelled) {
          setHeaderShowsComplete(isRequiredProfileComplete(next));
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Erro ao carregar perfil.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      toast.error("Sessão expirada. Entre novamente.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: data.name.trim(),
        phone: data.phone.trim(),
        cpf: data.cpf.trim(),
        data_nascimento: data.birthDate || null,
        cep: data.zip.trim() || null,
        logradouro: data.street.trim() || null,
        numero: data.number.trim() || null,
        complemento: data.complement.trim() || null,
        bairro: data.district.trim() || null,
        cidade: data.city.trim() || null,
        uf: data.state.trim() ? data.state.trim().toUpperCase().slice(0, 2) : null,
        ponto_referencia: data.reference.trim() || null,
        contato_emergencia: data.emergencyContact.trim() || null,
      };
      const response = await fetch("/api/portal/profile/patient", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as { detail?: string | unknown[] };
      if (!response.ok) {
        throw new Error(formatApiErrorDetail(json.detail) || "Não foi possível salvar.");
      }
      toast.success("Perfil salvo com sucesso.");
      setAttentionMessage(null);
      setHeaderShowsComplete(isRequiredProfileComplete(data));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function field<K extends keyof PatientProfileFormState>(key: K, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
        Carregando seus dados…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Perfil do paciente</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          {headerShowsComplete ? "Meu perfil" : "Completar dados"}
        </h1>
        {headerShowsComplete ? (
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Aqui você mantém seus dados de contato e cadastro na clínica atualizados, com privacidade e segurança.
          </p>
        ) : (
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            <strong className="font-semibold text-slate-800">Nome completo, telefone e CPF são obrigatórios.</strong> Os
            demais campos são opcionais. Os dados ficam salvos na sua conta.
          </p>
        )}
      </section>

      {attentionMessage ? <ProfileAttentionBanner message={attentionMessage} /> : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Identificação (obrigatório)</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Nome completo</span>
              <input
                required
                value={data.name}
                onChange={(e) => field("name", e.target.value)}
                className={fieldClassName}
                placeholder="Como no documento"
                autoComplete="name"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Telefone (com DDD)</span>
              <input
                required
                type="tel"
                inputMode="tel"
                value={data.phone}
                onChange={(e) => field("phone", e.target.value)}
                className={fieldClassName}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">CPF</span>
              <input
                required
                value={data.cpf}
                onChange={(e) => field("cpf", e.target.value)}
                className={fieldClassName}
                placeholder="000.000.000-00"
                autoComplete="off"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Documento complementar (opcional)</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Data de nascimento</span>
              <input
                type="date"
                value={data.birthDate}
                onChange={(e) => field("birthDate", e.target.value)}
                className={fieldClassName}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Contato de emergência (opcional)</legend>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Nome e telefone de outra pessoa</span>
            <input
              value={data.emergencyContact}
              onChange={(e) => field("emergencyContact", e.target.value)}
              className={fieldClassName}
              placeholder="Ex.: Maria Silva — (11) 98888-7777"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Endereço (opcional)</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="text-sm font-medium text-slate-700">CEP</span>
              <input
                value={data.zip}
                onChange={(e) => field("zip", e.target.value)}
                className={fieldClassName}
                placeholder="00000-000"
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Rua / Avenida</span>
              <input
                value={data.street}
                onChange={(e) => field("street", e.target.value)}
                className={fieldClassName}
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Número</span>
              <input
                value={data.number}
                onChange={(e) => field("number", e.target.value)}
                className={fieldClassName}
              />
            </label>
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Complemento</span>
              <input
                value={data.complement}
                onChange={(e) => field("complement", e.target.value)}
                className={fieldClassName}
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
                className={fieldClassName}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Cidade</span>
              <input
                value={data.city}
                onChange={(e) => field("city", e.target.value)}
                className={fieldClassName}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">UF</span>
              <input
                value={data.state}
                onChange={(e) => field("state", e.target.value.toUpperCase().slice(0, 2))}
                className={`${fieldClassName} uppercase`}
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
              className={fieldClassName}
              placeholder="Próximo a..."
            />
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar perfil"}
        </button>
      </form>
    </div>
  );
}
