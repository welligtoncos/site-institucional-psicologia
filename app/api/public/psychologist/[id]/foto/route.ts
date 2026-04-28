import { NextResponse } from "next/server";

import { getBackendApiUrl } from "@/app/lib/backend";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Proxy da foto pública do psicólogo: o catálogo guarda data URLs grandes;
 * repassar só esta URL curta para o cliente evita estourar serialização RSC e falha silenciosa no /equipe.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const backend = getBackendApiUrl().replace(/\/+$/, "");
  const url = `${backend}/public/catalog/psychologists/${encodeURIComponent(id)}/foto`;

  try {
    const res = await fetch(url, { redirect: "follow", next: { revalidate: 60 } });

    if (res.status === 404) {
      return new NextResponse(null, { status: 404 });
    }
    if (!res.ok) {
      return new NextResponse(null, { status: 502 });
    }

    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      return new NextResponse(null, { status: 404 });
    }

    const buf = await res.arrayBuffer();
    const safeCt =
      ct.startsWith("image/") || ct === "application/octet-stream" ? ct : "image/jpeg";

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": safeCt,
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
