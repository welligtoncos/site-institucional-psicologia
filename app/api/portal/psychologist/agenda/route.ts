import { NextResponse } from "next/server";
import { getBackendApiUrl } from "@/app/lib/backend";
import { requirePortalRole, toNextResponse } from "@/app/api/portal/_utils/backend-proxy";

export async function GET(request: Request) {
  const auth = await requirePortalRole(request, ["psychologist", "admin"]);
  if (!auth.ok) return auth.response;

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

  return toNextResponse(response);
}
