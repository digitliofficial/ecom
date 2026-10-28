from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_address_validate():
    res = client.post(
        "/v1/address/validate",
        json={"line1": " 1 Main St ", "city": " Karachi ", "country": "pk"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is True
    assert data["normalized"]["country"] == "PK"
    assert "postal_code_missing" in data["warnings"]


def test_shipping_rates():
    res = client.post(
        "/v1/shipping/rates",
        json={"to": {"line1": "1 Main", "city": "Karachi", "country": "PK"}},
    )
    assert res.status_code == 200
    assert res.json()["rates"][0]["carrier"] == "manual"
