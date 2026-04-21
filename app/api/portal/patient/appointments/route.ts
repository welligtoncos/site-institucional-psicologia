import { NextResponse } from "next/server";

import { getBackendApiUrl } from "@/app/lib/backend";

function forwardAuth(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { error: NextResponse.json({ detail: "Token de acesso ausente." }, { status: 401 }) };
  }
  return { authHeader };
}

export async function POST(request: Request) {
  const auth = forwardAuth(request);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ detail: "Corpo JSON inválido." }, { status: 400 });
  }

  const response = await fetch(`${getBackendApiUrl()}/profiles/patient/me/appointments`, {
    method: "POST",
    headers: {
      Authorization: auth.authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({ detail: "Resposta inválida do backend." }));
  return NextResponse.json(data, { status: response.status });
}

export async function GET(request: Request) {
  const auth = forwardAuth(request);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const fromDate = url.searchParams.get("from_date");
  const qs = fromDate ? `?from_date=${encodeURIComponent(fromDate)}` : "";

  const response = await fetch(`${getBackendApiUrl()}/profiles/patient/me/appointments${qs}`, {
    method: "GET",
    headers: {
      Authorization: auth.authHeader,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({ detail: "Resposta inválida do backend." }));
  return NextResponse.json(data, { status: response.status });
}
