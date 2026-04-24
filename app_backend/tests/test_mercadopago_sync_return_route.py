"""POST /profiles/patient/me/mercadopago/sync-return — JWT obrigatório."""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_mercadopago_sync_return_401_without_token() -> None:
    response = client.post(
        "/profiles/patient/me/mercadopago/sync-return",
        json={"payment_id": "12345678901"},
    )
    assert response.status_code == 401
