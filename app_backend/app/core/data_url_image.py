"""Extrai bytes e tipo MIME de data URLs (RFC 2397), usadas para foto em `psicologos.foto_url`."""

from __future__ import annotations

import base64
import re


def parse_data_url_image(data_url: str) -> tuple[bytes, str] | None:
    """
    Aceita `data:image/jpeg;base64,...` e retorna (bytes, media_type).
    Retorna None se não for um data URL parseável como imagem binária.
    """
    s = data_url.strip()
    if not s.startswith("data:"):
        return None
    try:
        comma = s.index(",")
    except ValueError:
        return None

    meta = s[5:comma].strip()
    payload = s[comma + 1 :]

    if ";base64" not in meta and not meta.endswith("base64"):
        # formato não-base64 (URL-encoded) — incomum para uploads do portal
        return None

    mime = meta.split(";")[0].strip() if meta else ""
    if not mime:
        mime = "application/octet-stream"

    b64 = re.sub(r"\s+", "", payload)
    try:
        raw = base64.b64decode(b64, validate=True)
    except Exception:
        try:
            raw = base64.b64decode(b64, validate=False)
        except Exception:
            return None

    if len(raw) == 0:
        return None
    return raw, mime
