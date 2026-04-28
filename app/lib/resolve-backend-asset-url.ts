import { getBackendApiUrl } from "@/app/lib/backend";

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

/** Monta URL absoluta para foto/arquivo quando o backend devolve caminho relativo. */
export function resolveBackendAssetUrl(fotoUrl: string | null): string | null {
  if (!fotoUrl) return null;
  // Imagem embutida salva no banco (data URL base64) — usar direto no <img src>.
  if (fotoUrl.startsWith("data:")) {
    return fotoUrl;
  }
  if (fotoUrl.startsWith("http://") || fotoUrl.startsWith("https://")) {
    return fotoUrl;
  }
  const base = stripTrailingSlash(getBackendApiUrl());
  const path = fotoUrl.startsWith("/") ? fotoUrl : `/${fotoUrl}`;
  return `${base}${path}`;
}
