"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { formatApiErrorDetail } from "@/app/lib/portal-errors";

const ACCESS_TOKEN_KEY = "portal_access_token";

type CatalogItem = {
  id: string;
  nome: string;
  crp: string;
  bio: string;
  valor_consulta: string;
  duracao_minutos: number;
  foto_url: string | null;
  especialidades: string[];
};

const AVATAR_GRADIENTS = [
  "from-violet-500 to-fuchsia-600",
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
];

function gradientForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h + id.charCodeAt(i)) % 997;
  }
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length] ?? AVATAR_GRADIENTS[0];
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const a = parts[0][0];
  const b = parts[parts.length - 1][0];
  if (!a || !b) return "?";
  return (a + b).toUpperCase();
}

function formatBrl(value: string): string {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function OffersBoard() {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
    if (!token) {
      setError("Sessão não encontrada. Faça login novamente.");
      setItems([]);
      setLoading(false);
      return;
    }

    const response = await fetch("/api/portal/psychologists?limit=50", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = (await response.json().catch(() => null)) as
      | CatalogItem[]
      | { detail?: unknown };

    if (!response.ok) {
      setError(formatApiErrorDetail(data));
      setItems([]);
      setLoading(false);
      return;
    }

    if (!Array.isArray(data)) {
      setError("Resposta inválida do servidor.");
      setItems([]);
      setLoading(false);
      return;
    }

    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-600">Carregando profissionais...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <p className="text-sm text-rose-800">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!items?.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-600">Nenhum profissional disponível no momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Profissionais</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Escolha um profissional</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Perfis ativos da clínica: especialidades, biografia e valores da sessão.
        </p>
      </section>

      <ul className="space-y-6">
        {items.map((psych) => {
          const grad = gradientForId(psych.id);
          const specs = psych.especialidades?.length ? psych.especialidades.join(" · ") : "Especialidades a definir";
          return (
            <li key={psych.id}>
              <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex gap-4 p-5">
                  {psych.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={psych.foto_url}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-inner"
                    />
                  ) : (
                    <div
                      className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-lg font-bold text-white shadow-inner`}
                      aria-hidden
                    >
                      {initialsFromName(psych.nome)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-slate-900">{psych.nome}</h2>
                    <p className="text-xs font-medium text-sky-700">CRP {psych.crp}</p>
                    <p className="mt-1 text-xs text-slate-500">{specs}</p>
                  </div>
                </div>
                <div className="border-t border-slate-100 px-5 py-4">
                  <p className="text-sm leading-relaxed text-slate-600">{psych.bio || "Biografia em breve."}</p>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-700 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-slate-500">Valor da sessão</dt>
                      <dd className="font-semibold text-slate-900">R$ {formatBrl(psych.valor_consulta)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Duração</dt>
                      <dd>{psych.duracao_minutos} min</dd>
                    </div>
                  </dl>
                  <Link
                    href={`/portal/agendar?psych=${encodeURIComponent(psych.id)}`}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
                  >
                    Agendar consulta
                  </Link>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
