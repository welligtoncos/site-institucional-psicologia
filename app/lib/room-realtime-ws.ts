import { getBackendApiUrl } from "@/app/lib/backend";

type RoomStatusEvent = {
  type: "room_status";
  appointment_id: string;
  patient_online: boolean;
  psychologist_online: boolean;
  meeting_link?: string | null;
  session_started: boolean;
  /** ISO8601 do servidor — base do cronômetro compartilhado. */
  session_started_at?: string | null;
  updated_at: string;
};

const ACCESS_TOKEN_KEY = "portal_access_token";

/** Alinhado ao path `appointment_id: UUID` da API — evita WebSocket para mocks (`apt-1`, etc.). */
const BACKEND_APPOINTMENT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBackendAppointmentId(id: string): boolean {
  return BACKEND_APPOINTMENT_UUID_RE.test(String(id).trim());
}

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

function toWsBaseUrl(httpUrl: string): string {
  if (httpUrl.startsWith("https://")) return `wss://${httpUrl.slice("https://".length)}`;
  if (httpUrl.startsWith("http://")) return `ws://${httpUrl.slice("http://".length)}`;
  return httpUrl;
}

export function openRoomRealtimeSocket(
  appointmentId: string,
  onRoomStatus: (event: RoomStatusEvent) => void,
): WebSocket | null {
  const token = readToken();
  if (!token) return null;
  if (!isBackendAppointmentId(appointmentId)) return null;
  const base = toWsBaseUrl(getBackendApiUrl()).replace(/\/$/, "");
  const url = `${base}/ws/appointments/${encodeURIComponent(appointmentId)}?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);
  ws.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data) as RoomStatusEvent;
      if (data && data.type === "room_status") onRoomStatus(data);
    } catch {
      /* ignore malformed events */
    }
  };
  return ws;
}

export type RoomRealtimeClientEvent =
  | { type: "meeting_link_updated"; meeting_link: string }
  | { type: "session_started"; session_started_at?: string | null }
  | { type: "session_ended" };

export function sendRoomRealtimeEvent(ws: WebSocket | null, payload: RoomRealtimeClientEvent): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}
