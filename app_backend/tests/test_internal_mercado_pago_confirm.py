"""POST /internal/mercadopago/confirm-payment — segredo no header e persistência."""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.repositories.clinical_repository import ClinicalRepository
from main import app

client = TestClient(app)

_TEST_INTERNAL_SECRET = "test-internal-webhook-secret"


@pytest.fixture(autouse=True)
def _force_internal_webhook_secret_for_tests() -> None:
    """`.env` real define MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET; estes testes precisam de valor fixo."""
    previous = os.environ.get("MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET")
    os.environ["MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET"] = _TEST_INTERNAL_SECRET
    get_settings.cache_clear()
    yield
    if previous is None:
        os.environ.pop("MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET", None)
    else:
        os.environ["MERCADO_PAGO_INTERNAL_WEBHOOK_SECRET"] = previous
    get_settings.cache_clear()
_APPROVED_BODY = {
    "consulta_id": "550e8400-e29b-41d4-a716-446655440000",
    "payment_id": "12345678901",
    "status": "approved",
}


def test_confirm_payment_401_without_header() -> None:
    response = client.post("/internal/mercadopago/confirm-payment", json=_APPROVED_BODY)
    assert response.status_code == 401


def test_confirm_payment_401_wrong_secret() -> None:
    response = client.post(
        "/internal/mercadopago/confirm-payment",
        headers={"X-Internal-Webhook-Secret": "wrong"},
        json=_APPROVED_BODY,
    )
    assert response.status_code == 401


def test_confirm_payment_skips_when_not_approved() -> None:
    response = client.post(
        "/internal/mercadopago/confirm-payment",
        headers={"X-Internal-Webhook-Secret": _TEST_INTERNAL_SECRET},
        json={**_APPROVED_BODY, "status": "pending"},
    )
    assert response.status_code == 200
    assert response.json().get("skipped") is True


def test_confirm_payment_success(monkeypatch) -> None:
    mock_mark = AsyncMock(return_value=(MagicMock(), MagicMock()))
    monkeypatch.setattr(ClinicalRepository, "mark_payment_success_for_consulta", mock_mark)

    response = client.post(
        "/internal/mercadopago/confirm-payment",
        headers={"X-Internal-Webhook-Secret": _TEST_INTERNAL_SECRET},
        json=_APPROVED_BODY,
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("saved") is True
    mock_mark.assert_awaited_once()


def test_confirm_payment_idempotent_already_paid(monkeypatch) -> None:
    from app.core.exceptions import ConflictError

    async def raise_already(*_a, **_kw):
        raise ConflictError("Pagamento já registrado.")

    monkeypatch.setattr(ClinicalRepository, "mark_payment_success_for_consulta", raise_already)

    response = client.post(
        "/internal/mercadopago/confirm-payment",
        headers={"X-Internal-Webhook-Secret": _TEST_INTERNAL_SECRET},
        json=_APPROVED_BODY,
    )
    assert response.status_code == 200
    assert response.json().get("idempotent") is True
