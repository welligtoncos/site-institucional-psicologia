import { NextResponse } from "next/server";
import { getBackendApiUrl } from "@/app/lib/backend";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ detail: "Payload invalido." }, { status: 400 });
  }

  const response = await fetch(`${getBackendApiUrl()}/auth/register/patient`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({ detail: "Resposta invalida do backend." }));
  return NextResponse.json(data, { status: response.status });
}
