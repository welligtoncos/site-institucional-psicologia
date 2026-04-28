import "server-only";

import { getBackendApiUrl } from "@/app/lib/backend";

/** Resposta de GET /public/catalog/psychologists */
export type PsychologistCatalogApi = {
  id: string;
  nome: string;
  crp: string;
  bio: string;
  valor_consulta: string;
  duracao_minutos: number;
  foto_url: string | null;
  especialidades: string[];
};

export type BookableDayApi = {
  date: string;
  weekday: number;
  weekday_label: string;
  slots: string[];
};

/** Psicólogo com agenda já filtrada (apenas dias com vaga). */
export type EquipePsychologist = PsychologistCatalogApi & {
  agendaDays: BookableDayApi[];
};

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

/** Monta URL absoluta para foto quando o backend devolve caminho relativo. */
export function resolveBackendAssetUrl(fotoUrl: string | null): string | null {
  if (!fotoUrl) return null;
  if (fotoUrl.startsWith("http://") || fotoUrl.startsWith("https://")) {
    return fotoUrl;
  }
  const base = stripTrailingSlash(getBackendApiUrl());
  const path = fotoUrl.startsWith("/") ? fotoUrl : `/${fotoUrl}`;
  return `${base}${path}`;
}

export function formatBrlFromApi(value: string): string {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type LoadEquipeResult =
  | { ok: true; psychologists: EquipePsychologist[] }
  | { ok: false; message: string };

const DEFAULT_DAYS = 14;

/**
 * Carrega catálogo + horários livres por profissional a partir da API FastAPI.
 * Usa `BACKEND_API_URL` / `NEXT_PUBLIC_BACKEND_API_URL` (mesmo host do portal).
 */
export async function loadEquipePsychologists(days: number = DEFAULT_DAYS): Promise<LoadEquipeResult> {
  const base = stripTrailingSlash(getBackendApiUrl());

  try {
    const listRes = await fetch(`${base}/public/catalog/psychologists?skip=0&limit=50`, {
      next: { revalidate: 120 },
      headers: { Accept: "application/json" },
    });

    if (!listRes.ok) {
      const err = (await listRes.json().catch(() => null)) as { detail?: unknown } | null;
      const detail = err?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : `Nao foi possivel carregar a equipe (HTTP ${listRes.status}).`;
      return { ok: false, message };
    }

    const list = (await listRes.json()) as PsychologistCatalogApi[];
    const psychologists: EquipePsychologist[] = [];

    for (const p of list) {
      let agendaDays: BookableDayApi[] = [];
      try {
        const slotsRes = await fetch(
          `${base}/public/catalog/psychologists/${encodeURIComponent(p.id)}/bookable-slots?days=${encodeURIComponent(String(days))}`,
          { next: { revalidate: 60 }, headers: { Accept: "application/json" } },
        );
        if (slotsRes.ok) {
          const payload = (await slotsRes.json()) as { days?: BookableDayApi[] };
          const raw = payload.days ?? [];
          agendaDays = raw.filter((day) => day.slots.length > 0);
        }
      } catch {
        agendaDays = [];
      }

      psychologists.push({
        ...p,
        agendaDays,
      });
    }

    return { ok: true, psychologists };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao conectar com o servidor.";
    return { ok: false, message };
  }
}
