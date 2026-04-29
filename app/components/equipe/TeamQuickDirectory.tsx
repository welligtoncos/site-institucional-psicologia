"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { EquipeCardModel } from "@/app/lib/equipe-types";
import { equipeRecentPsychologistAnchor } from "@/app/lib/site";
import { ActionLink } from "@/app/components/ui/SitePrimitives";
import { CompactBio } from "./CompactBio";
import { EquipeAvailabilityCalendar } from "./EquipeAvailabilityCalendar";

type TeamQuickDirectoryProps = {
  psychologists: EquipeCardModel[];
  registerUrl: string;
  bookUrl: string;
  initialPsychologistId?: string;
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

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function TeamQuickDirectory({
  psychologists,
  registerUrl,
  bookUrl,
  initialPsychologistId,
}: TeamQuickDirectoryProps) {
  const [query, setQuery] = useState("");
  const selectedCardId = initialPsychologistId ? `psych-card-${initialPsychologistId}` : null;

  const sortedPsychologists = useMemo(() => {
    if (!initialPsychologistId) return psychologists;
    const idx = psychologists.findIndex((p) => p.id === initialPsychologistId);
    if (idx <= 0) return psychologists;
    const chosen = psychologists[idx];
    return [chosen, ...psychologists.slice(0, idx), ...psychologists.slice(idx + 1)];
  }, [psychologists, initialPsychologistId]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return sortedPsychologists;
    return sortedPsychologists.filter((p) => {
      const hay = [p.nome, p.crp, p.bio, ...p.especialidades].map(norm).join(" ");
      return hay.includes(q);
    });
  }, [sortedPsychologists, query]);

  const totalSlots = useMemo(
    () =>
      psychologists.reduce((acc, p) => acc + p.agendaDays.reduce((a, d) => a + d.slots.length, 0), 0),
    [psychologists],
  );

  /** Mesmo índice que no catálogo público da API (mais recente primeiro). */
  const recentPsychologistId = psychologists[0]?.id ?? null;

  useEffect(() => {
    if (!selectedCardId) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(selectedCardId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [selectedCardId]);

  return (
    <div className="space-y-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <label htmlFor="equipe-busca" className="block text-sm font-semibold text-slate-900">
          Busca rapida
        </label>
        <p className="mt-1 text-sm text-slate-600">
          Nome, CRP, especialidade ou palavra na bio — dados atualizados a partir do sistema da clinica.
        </p>
        <input
          id="equipe-busca"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex.: TCC, ansiedade, CRP..."
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none ring-sky-200 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-2"
          autoComplete="off"
        />
      </div>

      <section className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-sky-50/60 p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Resumo da agenda</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Horarios livres da semana (proximos 7 dias), por profissional abaixo. Para reservar com pagamento e
              confirmacao, use o portal do paciente.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white/80 px-4 py-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Vagas somadas</p>
            <p className="text-2xl font-semibold tabular-nums text-emerald-900">{totalSlots}</p>
            <p className="text-xs text-emerald-700">proximos 7 dias</p>
          </div>
        </div>

        {totalSlots === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/90 p-5 text-sm text-slate-700">
            <p className="font-medium text-slate-900">Nenhum horario livre no periodo consultado.</p>
            <p className="mt-2 text-slate-600">
              A agenda e atualizada em tempo real no sistema para os proximos 7 dias. Cadastre-se no portal ou volte
              mais tarde.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ActionLink href={registerUrl}>Criar conta no portal</ActionLink>
              <ActionLink href={bookUrl} variant="secondary">
                Ja tenho cadastro
              </ActionLink>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3 border-t border-emerald-100/80 pt-6">
          <ActionLink href={registerUrl}>Agendar pelo portal</ActionLink>
          <ActionLink href={bookUrl} variant="secondary">
            Entrar e escolher horario
          </ActionLink>
        </div>
      </section>

      <div className="grid gap-6 lg:gap-8">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
            Nenhum resultado para &ldquo;{query}&rdquo;. Tente outro termo ou limpe a busca.
          </p>
        ) : (
          filtered.map((member) => {
            const cardId = member.id === initialPsychologistId ? `psych-card-${member.id}` : undefined;
            const anchorId = member.id === recentPsychologistId ? equipeRecentPsychologistAnchor : undefined;
            return (
              <article
                key={member.id}
                id={cardId ?? anchorId}
                className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${member.id === recentPsychologistId ? "scroll-mt-28" : ""}`}
              >
              <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,200px)_1fr] md:p-8">
                <div className="mx-auto w-full max-w-[200px] md:mx-0">
                  <div className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    {member.fotoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL dinâmica do backend (domínio variável).
                      <img
                        src={member.fotoSrc}
                        alt={member.nome}
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-2xl font-bold text-white ${gradientForId(member.id)}`}
                        aria-hidden
                      >
                        {initialsFromName(member.nome)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-slate-900">{member.nome}</h2>
                  <p className="mt-1 text-sm font-medium text-sky-700">{member.crp}</p>

                  <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-800">Sessao</p>
                      <p className="text-lg font-semibold tabular-nums text-slate-900 sm:text-xl">{member.valorConsultaLabel}</p>
                    </div>
                    <p className="text-xs text-sky-900/85">
                      <span className="font-semibold">{member.duracaoMinutos} min</span> · valor conforme cadastro no portal
                    </p>
                  </div>

                  {member.especialidades.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {member.especialidades.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {member.bio ? <CompactBio text={member.bio} /> : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <ActionLink href={registerUrl}>Quero agendar</ActionLink>
                    <Link
                      href={bookUrl}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Ja sou paciente
                    </Link>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 bg-emerald-50/20 px-6 py-6 md:px-8">
                <h3 className="text-sm font-semibold text-slate-900">Agenda — escolha o dia no calendario</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Dias com linha verde tem vaga; depois selecione o horario ao lado.
                </p>
                <div className="mt-4">
                  <EquipeAvailabilityCalendar agendaDays={member.agendaDays} />
                </div>
              </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
