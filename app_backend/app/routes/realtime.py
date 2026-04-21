"""WebSocket para presença em sala de consulta."""

from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError
from jose.exceptions import ExpiredSignatureError

from app.core.database import AsyncSessionLocal
from app.core.security import TOKEN_TYPE_ACCESS, decode_token
from app.models.clinical import ConsultaStatus, SessaoAoVivoFase
from app.models.user import UserRole
from app.repositories.clinical_repository import ClinicalRepository
from app.repositories.user_repository import UserRepository
from app.services.room_realtime_service import room_realtime_service

router = APIRouter(tags=["realtime"])


async def _close_policy(websocket: WebSocket, reason: str) -> None:
    await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=reason)


@router.websocket("/ws/appointments/{appointment_id}")
async def appointment_room_ws(websocket: WebSocket, appointment_id: UUID) -> None:
    token = (websocket.query_params.get("token") or "").strip()
    if not token:
        await _close_policy(websocket, "Token ausente.")
        return

    try:
        payload = decode_token(token)
    except ExpiredSignatureError:
        await _close_policy(websocket, "Token expirado.")
        return
    except JWTError:
        await _close_policy(websocket, "Token inválido.")
        return

    if payload.get("type") != TOKEN_TYPE_ACCESS:
        await _close_policy(websocket, "Token inválido.")
        return

    subject = payload.get("sub")
    role_claim = payload.get("role")
    if not isinstance(subject, str) or not subject or not isinstance(role_claim, str) or not role_claim:
        await _close_policy(websocket, "Sessão inválida.")
        return

    try:
        user_id = UUID(subject)
    except ValueError:
        await _close_policy(websocket, "Sessão inválida.")
        return

    async with AsyncSessionLocal() as db:
        user_repo = UserRepository(db)
        clinical_repo = ClinicalRepository(db)
        user = await user_repo.get_by_id(user_id)
        if user is None or not user.is_active:
            await _close_policy(websocket, "Usuário não autorizado.")
            return
        role = user.role.value
        if role_claim != role:
            await _close_policy(websocket, "Sessão desatualizada.")
            return
        if role == UserRole.patient.value:
            consulta = await clinical_repo.get_consulta_com_cobranca_do_paciente(appointment_id, user.id)
        elif role == UserRole.psychologist.value:
            consulta = await clinical_repo.get_consulta_com_cobranca_do_psicologo(appointment_id, user.id)
        else:
            await _close_policy(websocket, "Papel não autorizado para sala.")
            return
        if consulta is None:
            await _close_policy(websocket, "Consulta não encontrada para este usuário.")
            return
        sessao = getattr(consulta, "sessao_ao_vivo", None)
        meeting_link = consulta.link_videochamada_opcional
        if sessao is not None and getattr(sessao, "url_meet", None):
            meeting_link = sessao.url_meet
        session_started = consulta.status == ConsultaStatus.em_andamento or (
            sessao is not None and sessao.fase == SessaoAoVivoFase.live and sessao.encerrada_em is None
        )

    room_id = str(appointment_id)
    await room_realtime_service.connect(
        appointment_id=room_id,
        websocket=websocket,
        role=role,
        meeting_link=meeting_link,
        session_started=session_started,
    )
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if not isinstance(message, dict):
                continue
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            if role == UserRole.psychologist.value:
                await room_realtime_service.update_from_message(appointment_id=room_id, message=message)
    except WebSocketDisconnect:
        pass
    finally:
        await room_realtime_service.disconnect(appointment_id=room_id, websocket=websocket)
