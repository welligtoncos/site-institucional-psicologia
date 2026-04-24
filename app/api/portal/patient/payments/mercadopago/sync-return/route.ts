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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "JSON inválido." }, { status: 400 });
  }

  const response = await fetch(`${getBackendApiUrl()}/profiles/patient/me/mercadopago/sync-return`, {
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
