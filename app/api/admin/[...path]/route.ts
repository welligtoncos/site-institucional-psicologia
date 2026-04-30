import { NextResponse } from "next/server";
import { getBackendApiUrl } from "@/app/lib/backend";
import { requirePortalRole, toNextResponse } from "@/app/api/portal/_utils/backend-proxy";

type RouteCtx = { params: Promise<{ path: string[] }> };

async function forward(request: Request, segments: string[]) {
  const auth = await requirePortalRole(request, ["admin"]);
  if (!auth.ok) {
    return auth.response;
  }
  const joined = segments.map((s) => encodeURIComponent(s)).join("/");
  const url = new URL(request.url);
  const target = `${getBackendApiUrl()}/admin/${joined}${url.search}`;

  const headers: Record<string, string> = {
    Authorization: auth.authHeader,
    Accept: "application/json",
  };
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.text();
    if (body) {
      init.body = body;
    }
  }

  const response = await fetch(target, init);
  return toNextResponse(response);
}

export async function GET(request: Request, ctx: RouteCtx) {
  const { path } = await ctx.params;
  if (!path?.length) {
    return NextResponse.json({ detail: "Rota admin inválida." }, { status: 400 });
  }
  return forward(request, path);
}

export async function POST(request: Request, ctx: RouteCtx) {
  const { path } = await ctx.params;
  if (!path?.length) {
    return NextResponse.json({ detail: "Rota admin inválida." }, { status: 400 });
  }
  return forward(request, path);
}

export async function PUT(request: Request, ctx: RouteCtx) {
  const { path } = await ctx.params;
  if (!path?.length) {
    return NextResponse.json({ detail: "Rota admin inválida." }, { status: 400 });
  }
  return forward(request, path);
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const { path } = await ctx.params;
  if (!path?.length) {
    return NextResponse.json({ detail: "Rota admin inválida." }, { status: 400 });
  }
  return forward(request, path);
}
