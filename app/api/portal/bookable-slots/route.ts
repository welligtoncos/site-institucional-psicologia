import { NextResponse } from "next/server";

import { getBackendApiUrl } from "@/app/lib/backend";

function forwardAuth(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { error: NextResponse.json({ detail: "Token de acesso ausente." }, { status: 401 }) };
  }
  return { authHeader };
}

export async function GET(request: Request) {
  const auth = forwardAuth(request);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const psychologistId = url.searchParams.get("psychologist_id")?.trim();
  const days = url.searchParams.get("days") ?? "7";

  if (!psychologistId) {
    return NextResponse.json({ detail: "Parâmetro psychologist_id é obrigatório." }, { status: 400 });
  }

  const response = await fetch(
    `${getBackendApiUrl()}/catalog/psychologists/${encodeURIComponent(psychologistId)}/bookable-slots?days=${encodeURIComponent(days)}`,
    {
      method: "GET",
      headers: {
        Authorization: auth.authHeader,
      },
      cache: "no-store",
    },
  );

  const data = await response.json().catch(() => ({ detail: "Resposta invalida do backend." }));
  // #region agent log
  if (response.ok && data && typeof data === "object" && "days" in data) {
    const d = data as {
      duracao_minutos?: number;
      weekly_template?: { weekday: number; ativo: boolean; start: string; end: string }[];
      days?: { date: string; slots: string[] }[];
    };
    fetch("http://127.0.0.1:7934/ingest/ae301534-ea0d-4f7b-a7be-1472a98c06a7", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6327f2" },
      body: JSON.stringify({
        sessionId: "6327f2",
        hypothesisId: "H1-H4",
        location: "app/api/portal/bookable-slots/route.ts:GET",
        message: "proxy bookable-slots ok",
        data: {
          psychologistId,
          duracao: d.duracao_minutos,
          weeklyTplCount: d.weekly_template?.length ?? 0,
          daySlotCounts: (d.days ?? []).map((x) => ({ date: x.date, n: x.slots?.length ?? 0 })),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion
  return NextResponse.json(data, { status: response.status });
}
