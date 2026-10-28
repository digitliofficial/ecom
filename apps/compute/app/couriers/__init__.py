"""CourierPort adapters (FastAPI).

MVP: ManualAdapter + AggregatorStubAdapter.
Extension: add Pakistan / local carriers under `local_pk_*` and register in
`registry.ADAPTERS` — Nest continues to call the same /v1/shipping/* surface.
"""

from app.couriers.registry import get_adapter

__all__ = ["get_adapter"]
