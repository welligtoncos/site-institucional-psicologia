import { NextResponse } from "next/server";
import { getBackendApiUrl } from "@/app/lib/backend";
import { toNextResponse } from "@/app/api/portal/_utils/backend-proxy";

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

  return toNextResponse(response);
}
