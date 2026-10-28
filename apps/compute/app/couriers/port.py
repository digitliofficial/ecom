from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field


class Address(BaseModel):
    name: str | None = None
    line1: str
    line2: str | None = None
    city: str
    region: str | None = None
    postal_code: str | None = Field(default=None, alias="postalCode")
    country: str

    model_config = {"populate_by_name": True}


class Rate(BaseModel):
    id: str
    carrier: str
    service: str
    amount_minor: int = Field(serialization_alias="amountMinor")
    currency: str
    estimated_days: int | None = Field(default=None, serialization_alias="estimatedDays")
    adapter: str
    shipping_method_id: str | None = Field(
        default=None, serialization_alias="shippingMethodId"
    )

    model_config = {"populate_by_name": True}


class LabelResult(BaseModel):
    tracking_number: str = Field(serialization_alias="trackingNumber")
    label_url: str | None = Field(default=None, serialization_alias="labelUrl")
    carrier: str | None = None
    adapter: str

    model_config = {"populate_by_name": True}


class TrackingEvent(BaseModel):
    status: str
    description: str | None = None
    occurred_at: str | None = Field(default=None, serialization_alias="occurredAt")
    provider_event_id: str | None = Field(
        default=None, serialization_alias="providerEventId"
    )

    model_config = {"populate_by_name": True}


class CourierPort(ABC):
    @abstractmethod
    def quote_rates(self, payload: dict[str, Any]) -> list[Rate]:
        ...

    @abstractmethod
    def create_shipment(self, payload: dict[str, Any]) -> LabelResult:
        ...

    @abstractmethod
    def track(self, tracking_number: str) -> list[TrackingEvent]:
        ...
