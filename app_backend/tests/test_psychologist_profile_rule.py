from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.core.psychologist_profile import is_professional_profile_complete


def _user(name: str):
    return SimpleNamespace(
        id=uuid4(),
        name=name,
        email="x@example.com",
        phone="",
        role=SimpleNamespace(value="psychologist"),
        is_active=True,
        terms_accepted_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )


def _ps(
    *,
    crp: str = "06/1-SP",
    bio: str = "1234567890",
    valor: Decimal = Decimal("100"),
    foto: str | None = "https://example.com/a.jpg",
    esp: str | None = "TCC",
):
    return SimpleNamespace(
        id=uuid4(),
        usuario_id=uuid4(),
        crp=crp,
        bio=bio,
        foto_url=foto,
        especialidades=esp,
        valor_sessao_padrao=valor,
        duracao_minutos_padrao=50,
        criado_em=datetime.now(timezone.utc),
    )


def test_complete_when_all_ok() -> None:
    u = _user("Maria Silva")
    p = _ps()
    assert is_professional_profile_complete(u, p) is True


def test_incomplete_without_name() -> None:
    u = _user("")
    p = _ps()
    assert is_professional_profile_complete(u, p) is False


def test_incomplete_without_foto() -> None:
    u = _user("Maria")
    p = _ps(foto=None)
    assert is_professional_profile_complete(u, p) is False


def test_incomplete_no_especialidades() -> None:
    u = _user("Maria")
    p = _ps(esp=None)
    assert is_professional_profile_complete(u, p) is False


def test_incomplete_short_bio() -> None:
    u = _user("Maria")
    p = _ps(bio="curta")
    assert is_professional_profile_complete(u, p) is False
