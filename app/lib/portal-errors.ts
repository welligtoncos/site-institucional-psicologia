/**
 * Normaliza mensagens de erro do FastAPI (detail string ou lista de erros 422).
 */
export function formatApiErrorDetail(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: string }).msg);
        }
        return "";
      })
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join(" ");
    }
  }
  return fallback;
}
