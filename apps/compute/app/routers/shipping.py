from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(tags=["shipping"])


class AddressIn(BaseModel):
    line1: str
    line2: str | None = None
    city: str
    region: str | None = None
    postal_code: str | None = Field(default=None, alias="postalCode")
    country: str

    model_config = {"populate_by_name": True}


class RatesIn(BaseModel):
    to: AddressIn
    weight_grams: int | None = Field(default=None, alias="weightGrams")

    model_config = {"populate_by_name": True}


class Rate(BaseModel):
    id: str
    carrier: str
    service: str
    amount_minor: int = Field(serialization_alias="amountMinor")
    currency: str

    model_config = {"populate_by_name": True}


@router.post("/shipping/rates")
def shipping_rates(_body: RatesIn) -> dict[str, list[Rate]]:
    """Manual adapter stub."""
    return {
        "rates": [
            Rate(
                id="manual_flat",
                carrier="manual",
                service="flat_rate",
                amount_minor=0,
                currency="USD",
            )
        ]
    }
