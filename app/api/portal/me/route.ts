import { NextResponse } from "next/server";
import { getBackendApiUrl } from "@/app/lib/backend";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ detail: "Token de acesso ausente." }, { status: 401 });
  }

  const response = await fetch(`${getBackendApiUrl()}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: authHeader,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({ detail: "Resposta invalida do backend." }));
  return NextResponse.json(data, { status: response.status });
}
