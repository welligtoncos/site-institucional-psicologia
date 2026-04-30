const ACCESS_TOKEN_KEY = "portal_access_token";

export function getPortalAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

/** Proxy Next `/api/admin/*` → FastAPI `/admin/*` (requer papel admin). */
export async function adminApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getPortalAccessToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const url = path.startsWith("/") ? `/api/admin${path}` : `/api/admin/${path}`;
  return fetch(url, { ...init, headers, cache: "no-store" });
}
