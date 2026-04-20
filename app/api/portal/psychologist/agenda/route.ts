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
  const fromDate = url.searchParams.get("from_date");
  const qs = fromDate ? `?from_date=${encodeURIComponent(fromDate)}` : "";

  const response = await fetch(`${getBackendApiUrl()}/profiles/psychologist/me/agenda${qs}`, {
    method: "GET",
    headers: {
      Authorization: auth.authHeader,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({ detail: "Resposta invalida do backend." }));
  return NextResponse.json(data, { status: response.status });
}
