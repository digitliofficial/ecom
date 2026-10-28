from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.couriers.port import Address, LabelResult, Rate, TrackingEvent
from app.couriers.registry import get_adapter

router = APIRouter(tags=["shipping"])


class MethodIn(BaseModel):
    id: str
    name: str
    price_amount_minor: int = Field(default=0, alias="priceAmountMinor")
    currency: str = "USD"

    model_config = {"populate_by_name": True}


class RatesIn(BaseModel):
    tenant_id: str | None = Field(default=None, alias="tenantId")
    to: Address
    from_: Address | None = Field(default=None, alias="from")
    weight_grams: int | None = Field(default=None, alias="weightGrams")
    method_id: str | None = Field(default=None, alias="methodId")
    currency: str | None = None
    adapter: str | None = "manual"
    methods: list[MethodIn] | None = None

    model_config = {"populate_by_name": True}


class CreateShipmentIn(BaseModel):
    tenant_id: str | None = Field(default=None, alias="tenantId")
    rate_id: str = Field(alias="rateId")
    order_id: str | None = Field(default=None, alias="orderId")
    to: Address
    from_: Address | None = Field(default=None, alias="from")
    adapter: str | None = "manual"

    model_config = {"populate_by_name": True}


@router.post("/shipping/rates")
def shipping_rates(body: RatesIn) -> dict[str, list[dict]]:
    """CourierPort.quoteRates — manual flat-rate and/or aggregator stub."""
    adapter_key = body.adapter or "manual"
    payload = {
        "tenantId": body.tenant_id,
        "to": body.to.model_dump(by_alias=True),
        "from": body.from_.model_dump(by_alias=True) if body.from_ else None,
        "weightGrams": body.weight_grams,
        "methodId": body.method_id,
        "currency": body.currency or "USD",
        "methods": [
            m.model_dump(by_alias=True) for m in (body.methods or [])
        ]
        or None,
    }
    try:
        if adapter_key == "all":
            rates = [
                *get_adapter("manual").quote_rates(payload),
                *get_adapter("aggregator_stub").quote_rates(payload),
            ]
        else:
            rates = get_adapter(adapter_key).quote_rates(payload)
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc

    return {
        "rates": [
            r.model_dump(by_alias=True) if isinstance(r, Rate) else r for r in rates
        ]
    }


@router.post("/shipping/shipments")
def create_shipment(body: CreateShipmentIn) -> dict:
    """CourierPort.createShipment / purchaseLabel stub."""
    adapter = get_adapter(body.adapter)
    try:
        result = adapter.create_shipment(
            {
                "tenantId": body.tenant_id,
                "rateId": body.rate_id,
                "orderId": body.order_id,
                "to": body.to.model_dump(by_alias=True),
                "from": body.from_.model_dump(by_alias=True) if body.from_ else None,
            }
        )
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    data = result.model_dump(by_alias=True) if isinstance(result, LabelResult) else result
    return data


@router.get("/shipping/track/{tracking_number}")
def track_shipment(tracking_number: str, adapter: str = "manual") -> dict[str, list[dict]]:
    """CourierPort.track stub."""
    port = get_adapter(adapter)
    try:
        events = port.track(tracking_number)
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    return {
        "events": [
            e.model_dump(by_alias=True) if isinstance(e, TrackingEvent) else e
            for e in events
        ]
    }
