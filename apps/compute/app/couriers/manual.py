from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.couriers.port import CourierPort, LabelResult, Rate, TrackingEvent


class ManualAdapter(CourierPort):
    """Flat-rate / merchant-configured methods — no live carrier API."""

    def quote_rates(self, payload: dict[str, Any]) -> list[Rate]:
        currency = payload.get("currency") or "USD"
        methods = payload.get("methods") or [
            {
                "id": "manual_flat",
                "name": "flat_rate",
                "priceAmountMinor": 0,
                "currency": currency,
            }
        ]
        method_id = payload.get("methodId")
        rates: list[Rate] = []
        for m in methods:
            mid = str(m.get("id") or m.get("shippingMethodId") or "")
            if method_id and mid != method_id:
                continue
            rates.append(
                Rate(
                    id=f"manual:{mid or 'flat'}",
                    carrier="manual",
                    service=str(m.get("name") or "flat_rate"),
                    amount_minor=int(m.get("priceAmountMinor") or m.get("amountMinor") or 0),
                    currency=str(m.get("currency") or currency),
                    adapter="manual",
                    shipping_method_id=mid or None,
                )
            )
        return rates

    def create_shipment(self, payload: dict[str, Any]) -> LabelResult:
        order_id = str(payload.get("orderId") or "")
        suffix = (order_id[:8] if order_id else datetime.now(UTC).strftime("%H%M%S")).upper()
        return LabelResult(
            tracking_number=f"MANUAL-{suffix}",
            carrier="manual",
            adapter="manual",
        )

    def track(self, tracking_number: str) -> list[TrackingEvent]:
        return [
            TrackingEvent(
                status="label_created",
                description=f"Manual shipment {tracking_number}",
                occurred_at=datetime.now(UTC).isoformat(),
            )
        ]
