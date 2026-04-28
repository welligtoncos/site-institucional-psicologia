import "server-only";

import { getBackendApiUrl } from "@/app/lib/backend";

export { resolveBackendAssetUrl } from "@/app/lib/resolve-backend-asset-url";

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
 * Sem cache HTTP do Next — valores e agenda devem espelhar o backend após cada alteração.
 */
export async function loadEquipePsychologists(days: number = DEFAULT_DAYS): Promise<LoadEquipeResult> {
  const base = getBackendApiUrl();

  try {
    const listRes = await fetch(`${base}/public/catalog/psychologists?skip=0&limit=50`, {
      cache: "no-store",
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

    /** Horários em paralelo — evita timeout em cadeia e falha silenciosa na agenda. */
    const psychologists: EquipePsychologist[] = await Promise.all(
      list.map(async (p) => {
        let agendaDays: BookableDayApi[] = [];
        try {
          const slotsUrl = `${base}/public/catalog/psychologists/${encodeURIComponent(String(p.id))}/bookable-slots?days=${encodeURIComponent(String(days))}`;
          const slotsRes = await fetch(slotsUrl, {
            cache: "no-store",
            headers: { Accept: "application/json" },
          });
          if (!slotsRes.ok) {
            const errBody = await slotsRes.text().catch(() => "");
            console.error(
              `[equipe] bookable-slots falhou HTTP ${slotsRes.status} para psicologo=${p.id}`,
              errBody.slice(0, 200),
            );
          } else {
            const payload = (await slotsRes.json()) as { days?: BookableDayApi[] };
            const rawDays = payload.days ?? [];
            agendaDays = rawDays.filter((day) => day.slots.length > 0);
          }
        } catch (e) {
          console.error(`[equipe] bookable-slots fetch erro psicologo=${p.id}`, e);
          agendaDays = [];
        }
        return {
          ...p,
          agendaDays,
        };
      }),
    );

    return { ok: true, psychologists };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao conectar com o servidor.";
    return { ok: false, message };
  }
}
