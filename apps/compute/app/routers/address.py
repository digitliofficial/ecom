from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(tags=["address"])


class AddressIn(BaseModel):
    line1: str
    line2: str | None = None
    city: str
    region: str | None = None
    postal_code: str | None = Field(default=None, alias="postalCode")
    country: str

    model_config = {"populate_by_name": True}


class AddressValidateOut(BaseModel):
    valid: bool
    warnings: list[str]
    normalized: AddressIn


@router.post("/address/validate", response_model=AddressValidateOut)
def validate_address(body: AddressIn) -> AddressValidateOut:
    """Stub: echo/normalize — soft-warn style."""
    warnings: list[str] = []
    normalized = body.model_copy(
        update={
            "line1": body.line1.strip(),
            "city": body.city.strip(),
            "country": body.country.strip().upper(),
        }
    )
    if not body.postal_code:
        warnings.append("postal_code_missing")
    return AddressValidateOut(valid=True, warnings=warnings, normalized=normalized)
