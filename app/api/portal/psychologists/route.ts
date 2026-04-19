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
  const skip = url.searchParams.get("skip") ?? "0";
  const limit = url.searchParams.get("limit") ?? "50";

  const response = await fetch(
    `${getBackendApiUrl()}/catalog/psychologists?skip=${encodeURIComponent(skip)}&limit=${encodeURIComponent(limit)}`,
    {
      method: "GET",
      headers: {
        Authorization: auth.authHeader,
      },
      cache: "no-store",
    },
  );

  const data = await response.json().catch(() => ({ detail: "Resposta invalida do backend." }));
  return NextResponse.json(data, { status: response.status });
}
