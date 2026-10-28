"""Pakistan / local courier extension point.

Implement a real HTTP client for TCS, Leopards, M&P, Trax, etc., then register
the adapter in `registry.ADAPTERS` under `local_pk_<slug>`. Nest shipping_methods
rows set `adapter = 'local_pk_<slug>'` — quote/book/track use the same CourierPort.
"""

from __future__ import annotations

from typing import Any

from app.couriers.port import CourierPort, LabelResult, Rate, TrackingEvent


class PakistanLocalCourierAdapterStub(CourierPort):
    def __init__(self, slug: str = "local_pk") -> None:
        self.slug = slug

    def quote_rates(self, _payload: dict[str, Any]) -> list[Rate]:
        raise NotImplementedError(
            f"{self.slug}: not implemented — plug carrier rate API here (Phase 2)"
        )

    def create_shipment(self, _payload: dict[str, Any]) -> LabelResult:
        raise NotImplementedError(
            f"{self.slug}: not implemented — plug carrier booking here (Phase 2)"
        )

    def track(self, _tracking_number: str) -> list[TrackingEvent]:
        raise NotImplementedError(
            f"{self.slug}: not implemented — plug carrier tracking here (Phase 2)"
        )
