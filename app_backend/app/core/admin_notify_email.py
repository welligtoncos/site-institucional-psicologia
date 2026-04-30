"""Envio opcional de e-mails administrativos via API REST do Resend (sem SDK Python)."""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Iterable

logger = logging.getLogger(__name__)


def _format_gateway_label(provedor: str) -> str:
    p = (provedor or "").strip().lower()
    if p == "mercadopago":
        return "Mercado Pago"
    if "mock" in p or p == "stripe_compatible_mock":
        return "Simulação / gateway de testes"
    return provedor or "—"


def send_resend_email(*, to_addresses: Iterable[str], subject: str, html_body: str) -> tuple[bool, str | None]:
    api_key = (os.getenv("RESEND_API_KEY") or "").strip()
    from_email = (os.getenv("RESEND_FROM_EMAIL") or "").strip() or "Clinica <onboarding@resend.dev>"
    recipients = [x.strip() for x in to_addresses if x and x.strip()]
    if not api_key:
        logger.info("RESEND_API_KEY ausente — e-mail não enviado: %s", subject)
        return False, "RESEND_API_KEY não configurado."
    if not recipients:
        return False, "Nenhum destinatário."

    payload = json.dumps(
        {
            "from": from_email,
            "to": recipients,
            "subject": subject,
            "html": html_body,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if 200 <= resp.status < 300:
                return True, None
            body = resp.read().decode("utf-8", errors="replace")
            logger.warning("Resend HTTP %s: %s", resp.status, body[:300])
            return False, f"Resend retornou HTTP {resp.status}."
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        logger.warning("Resend HTTPError %s: %s", e.code, body[:300])
        return False, f"Falha ao enviar e-mail (HTTP {e.code})."
    except OSError as e:
        logger.warning("Resend network error: %s", e)
        return False, "Falha de rede ao enviar e-mail."


def notify_consulta_alterada_html(
    *,
    titulo: str,
    alteracao: str,
    paciente_nome: str,
    profissional_nome: str,
    data_str: str,
    hora_str: str,
    modalidade: str,
) -> str:
    return f"""
    <div style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#0f172a;">
      <h2 style="margin:0 0 12px;">{titulo}</h2>
      <p style="margin:0 0 16px;color:#334155;">{alteracao}</p>
      <table style="border-collapse:collapse;max-width:520px;">
        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Paciente</td><td>{paciente_nome}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Profissional</td><td>{profissional_nome}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Data</td><td>{data_str}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Horário</td><td>{hora_str}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;font-weight:600;">Modalidade</td><td>{modalidade}</td></tr>
      </table>
      <p style="margin-top:20px;font-size:14px;color:#64748b;">Mensagem automática da clínica.</p>
    </div>
    """


__all__ = ["notify_consulta_alterada_html", "send_resend_email", "_format_gateway_label"]
