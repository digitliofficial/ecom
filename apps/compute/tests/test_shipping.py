from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_manual_shipping_rates_stub():
    res = client.post(
        "/v1/shipping/rates",
        json={
            "adapter": "manual",
            "currency": "USD",
            "to": {"line1": "1 St", "city": "Karachi", "country": "PK"},
            "methods": [
                {
                    "id": "m1",
                    "name": "Standard",
                    "priceAmountMinor": 500,
                    "currency": "USD",
                }
            ],
        },
    )
    assert res.status_code == 200
    rates = res.json()["rates"]
    assert len(rates) == 1
    assert rates[0]["adapter"] == "manual"
    assert rates[0]["amountMinor"] == 500


def test_aggregator_stub_rates():
    res = client.post(
        "/v1/shipping/rates",
        json={
            "adapter": "aggregator_stub",
            "to": {"line1": "1 St", "city": "Lahore", "country": "PK"},
        },
    )
    assert res.status_code == 200
    rates = res.json()["rates"]
    assert len(rates) >= 2
    assert all(r["adapter"] == "aggregator_stub" for r in rates)


def test_create_shipment_and_track_manual():
    created = client.post(
        "/v1/shipping/shipments",
        json={
            "adapter": "manual",
            "rateId": "manual:m1",
            "orderId": "abcdef12-0000-4000-8000-000000000099",
            "to": {"line1": "1 St", "city": "Karachi", "country": "PK"},
        },
    )
    assert created.status_code == 200
    body = created.json()
    assert body["trackingNumber"].startswith("MANUAL-")
    assert body["adapter"] == "manual"

    tracked = client.get(f"/v1/shipping/track/{body['trackingNumber']}?adapter=manual")
    assert tracked.status_code == 200
    assert len(tracked.json()["events"]) >= 1


def test_local_pk_extension_point_returns_501():
    res = client.post(
        "/v1/shipping/rates",
        json={
            "adapter": "local_pk_tcs",
            "to": {"line1": "1 St", "city": "Karachi", "country": "PK"},
        },
    )
    assert res.status_code == 501
