import { getBackendApiUrl } from "@/app/lib/backend";

type RoomStatusEvent = {
  type: "room_status";
  appointment_id: string;
  patient_online: boolean;
  psychologist_online: boolean;
  meeting_link?: string | null;
  session_started: boolean;
  updated_at: string;
};

const ACCESS_TOKEN_KEY = "portal_access_token";

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

export function sendRoomRealtimeEvent(
  ws: WebSocket | null,
  payload: { type: "meeting_link_updated"; meeting_link: string } | { type: "session_started" } | { type: "session_ended" },
): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}
