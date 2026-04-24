"""POST /mercado-pago/preferencia — corpo e resposta (SDK real mockado)."""

from fastapi.testclient import TestClient

from app.schemas.mercado_pago_schema import MercadoPagoPreferenciaResponse
from app.services.mercado_pago_service import MercadoPagoService
from main import app

client = TestClient(app)


def test_post_preferencia_success(monkeypatch) -> None:
    def fake_create(self, item, *, frontend_base_url: str, notification_url=None):  # noqa: ANN001
        assert frontend_base_url.startswith("http")
        return MercadoPagoPreferenciaResponse(
            preference_id="pref-test-1",
            init_point="https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-test-1",
            sandbox_init_point="https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-test-1",
        )

    monkeypatch.setattr(MercadoPagoService, "create_checkout_preference", fake_create)
    response = client.post(
        "/mercado-pago/preferencia",
        json={"order_id": 123, "title": "Meu produto", "quantity": 1, "unit_price": 75.76},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["preference_id"] == "pref-test-1"
    assert "init_point" in data
    assert data["sandbox_init_point"] is not None


def test_post_preferencia_validation_422() -> None:
    response = client.post(
        "/mercado-pago/preferencia",
        json={"title": "", "quantity": 0, "unit_price": -1},
    )
    assert response.status_code == 422


def test_notifications_get_ok() -> None:
    response = client.get("/mercado-pago/notifications?topic=payment&id=123")
    assert response.status_code == 200


def test_notifications_post_ok() -> None:
    response = client.post("/mercado-pago/notifications", data={"foo": "bar"})
    assert response.status_code == 200
