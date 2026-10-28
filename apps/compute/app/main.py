from fastapi import FastAPI

from app.routers import address, health, shipping

app = FastAPI(title="ecom-compute", version="0.0.0")
app.include_router(health.router)
app.include_router(address.router, prefix="/v1")
app.include_router(shipping.router, prefix="/v1")
