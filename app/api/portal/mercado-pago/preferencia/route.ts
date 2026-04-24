import { NextResponse } from "next/server";

import { getBackendApiUrl } from "@/app/lib/backend";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ detail: "Payload inválido." }, { status: 400 });
  }

  const response = await fetch(`${getBackendApiUrl()}/mercado-pago/preferencia`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({ detail: "Resposta inválida do backend." }));
  return NextResponse.json(data, { status: response.status });
}
