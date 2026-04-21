"""Gerencia presença e eventos em tempo real por sala (WebSocket)."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class _RoomState:
    sockets: set[WebSocket] = field(default_factory=set)
    roles_by_socket: dict[WebSocket, str] = field(default_factory=dict)
    meeting_link: str | None = None
    session_started: bool = False

    def payload(self, appointment_id: str) -> dict[str, Any]:
        patient_online = any(role == "patient" for role in self.roles_by_socket.values())
        psychologist_online = any(role == "psychologist" for role in self.roles_by_socket.values())
        return {
            "type": "room_status",
            "appointment_id": appointment_id,
            "patient_online": patient_online,
            "psychologist_online": psychologist_online,
            "meeting_link": self.meeting_link,
            "session_started": self.session_started,
            "updated_at": _utc_now_iso(),
        }


class RoomRealtimeService:
    def __init__(self) -> None:
        self._rooms: dict[str, _RoomState] = {}
        self._lock = asyncio.Lock()

    async def connect(
        self,
        *,
        appointment_id: str,
        websocket: WebSocket,
        role: str,
        meeting_link: str | None,
        session_started: bool,
    ) -> None:
        await websocket.accept()
        async with self._lock:
            room = self._rooms.setdefault(appointment_id, _RoomState())
            room.sockets.add(websocket)
            room.roles_by_socket[websocket] = role
            if meeting_link:
                room.meeting_link = meeting_link
            room.session_started = room.session_started or session_started
            payload = room.payload(appointment_id)
        await self._broadcast(appointment_id, payload)

    async def disconnect(self, *, appointment_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            room = self._rooms.get(appointment_id)
            if room is None:
                return
            room.sockets.discard(websocket)
            room.roles_by_socket.pop(websocket, None)
            if not room.sockets:
                self._rooms.pop(appointment_id, None)
                return
            payload = room.payload(appointment_id)
        await self._broadcast(appointment_id, payload)

    async def update_from_message(self, *, appointment_id: str, message: dict[str, Any]) -> None:
        async with self._lock:
            room = self._rooms.get(appointment_id)
            if room is None:
                return
            event_type = str(message.get("type") or "").strip().lower()
            if event_type == "meeting_link_updated":
                link = str(message.get("meeting_link") or "").strip()
                room.meeting_link = link or None
            elif event_type == "session_started":
                room.session_started = True
            elif event_type == "session_ended":
                room.session_started = False
            payload = room.payload(appointment_id)
        await self._broadcast(appointment_id, payload)

    async def _broadcast(self, appointment_id: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            room = self._rooms.get(appointment_id)
            if room is None:
                return
            targets = list(room.sockets)
        stale: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(payload)
            except Exception:
                stale.append(ws)
        if stale:
            async with self._lock:
                room = self._rooms.get(appointment_id)
                if room is None:
                    return
                for ws in stale:
                    room.sockets.discard(ws)
                    room.roles_by_socket.pop(ws, None)
                if not room.sockets:
                    self._rooms.pop(appointment_id, None)


room_realtime_service = RoomRealtimeService()
