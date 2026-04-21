import { NextResponse } from "next/server";

import { getBackendApiUrl } from "@/app/lib/backend";

function forwardAuth(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { error: NextResponse.json({ detail: "Token de acesso ausente." }, { status: 401 }) };
  }
  return { authHeader };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = forwardAuth(request);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ detail: "Corpo JSON inválido." }, { status: 400 });
  }

  const { id } = await context.params;
  const response = await fetch(
    `${getBackendApiUrl()}/profiles/psychologist/me/appointments/${encodeURIComponent(id)}/notes`,
    {
      method: "PATCH",
      headers: {
        Authorization: auth.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  const data = await response.json().catch(() => ({ detail: "Resposta inválida do backend." }));
  return NextResponse.json(data, { status: response.status });
}
