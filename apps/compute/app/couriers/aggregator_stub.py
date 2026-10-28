from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.couriers.port import CourierPort, LabelResult, Rate, TrackingEvent


class AggregatorStubAdapter(CourierPort):
    """Stand-in for EasyPost / Shippo until a real aggregator SDK is wired."""

    def quote_rates(self, payload: dict[str, Any]) -> list[Rate]:
        currency = payload.get("currency") or "USD"
        return [
            Rate(
                id="aggregator_stub:standard",
                carrier="aggregator_stub",
                service="standard",
                amount_minor=800,
                currency=currency,
                estimated_days=5,
                adapter="aggregator_stub",
            ),
            Rate(
                id="aggregator_stub:express",
                carrier="aggregator_stub",
                service="express",
                amount_minor=1800,
                currency=currency,
                estimated_days=2,
                adapter="aggregator_stub",
            ),
        ]

    def create_shipment(self, payload: dict[str, Any]) -> LabelResult:
        order_id = str(payload.get("orderId") or "")
        suffix = (order_id[:8] if order_id else datetime.now(timezone.utc).strftime("%H%M%S")).upper()
        return LabelResult(
            tracking_number=f"AGG-{suffix}",
            label_url=f"https://example.invalid/labels/{suffix}",
            carrier="aggregator_stub",
            adapter="aggregator_stub",
        )

    def track(self, tracking_number: str) -> list[TrackingEvent]:
        return [
            TrackingEvent(
                status="in_transit",
                description=f"Aggregator stub tracking for {tracking_number}",
                occurred_at=datetime.now(timezone.utc).isoformat(),
                provider_event_id=f"stub_{tracking_number}",
            )
        ]
