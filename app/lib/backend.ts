const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

export function getBackendApiUrl() {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_API_URL ||
    DEFAULT_BACKEND_URL
  );
}
