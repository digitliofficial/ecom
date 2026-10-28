from __future__ import annotations

from app.couriers.aggregator_stub import AggregatorStubAdapter
from app.couriers.local_pk import PakistanLocalCourierAdapterStub
from app.couriers.manual import ManualAdapter
from app.couriers.port import CourierPort

ADAPTERS: dict[str, type[CourierPort]] = {
    "manual": ManualAdapter,
    "aggregator_stub": AggregatorStubAdapter,
}


def get_adapter(key: str | None) -> CourierPort:
    name = (key or "manual").strip() or "manual"
    if name in ADAPTERS:
        return ADAPTERS[name]()
    if name.startswith("local_pk"):
        return PakistanLocalCourierAdapterStub(name)
    return ManualAdapter()
