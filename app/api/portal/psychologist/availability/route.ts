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

  const response = await fetch(`${getBackendApiUrl()}/profiles/psychologist/me/availability`, {
    method: "GET",
    headers: {
      Authorization: auth.authHeader,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({ detail: "Resposta invalida do backend." }));
  return NextResponse.json(data, { status: response.status });
}

export async function PUT(request: Request) {
  const auth = forwardAuth(request);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ detail: "Corpo JSON invalido." }, { status: 400 });
  }

  const response = await fetch(`${getBackendApiUrl()}/profiles/psychologist/me/availability`, {
    method: "PUT",
    headers: {
      Authorization: auth.authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({ detail: "Resposta invalida do backend." }));
  // #region agent log
  if ("weekly" in body && Array.isArray((body as { weekly: unknown }).weekly)) {
    const wk = (body as { weekly: { weekday: number; enabled?: boolean; start: string; end: string }[] }).weekly;
    fetch("http://127.0.0.1:7934/ingest/ae301534-ea0d-4f7b-a7be-1472a98c06a7", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6327f2" },
      body: JSON.stringify({
        sessionId: "6327f2",
        hypothesisId: "H3",
        location: "app/api/portal/psychologist/availability/route.ts:PUT",
        message: "availability PUT proxied",
        data: {
          responseOk: response.ok,
          status: response.status,
          requestWeeklyCount: wk.length,
          requestWeeklySample: wk.slice(0, 8).map((r) => ({
            weekday: r.weekday,
            enabled: r.enabled,
            start: r.start,
            end: r.end,
          })),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion
  return NextResponse.json(data, { status: response.status });
}
