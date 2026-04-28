const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

/**
 * URL da API FastAPI para chamadas **no servidor Next** (RSC, route handlers).
 * Em Docker Compose use `BACKEND_API_URL=http://api:8000` (nome do serviço), não `127.0.0.1`,
 * senão o fetch sai do container errado e a agenda da /equipe fica vazia.
 */
export function getBackendApiUrl() {
  const raw =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_API_URL ||
    DEFAULT_BACKEND_URL;
  return stripTrailingSlash(raw.trim());
}
