import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.exceptions import register_exception_handlers
from app.routers import (
    allocations,
    assets,
    attachments,
    audits,
    auth,
    bookings,
    categories,
    dashboard,
    departments,
    discrepancies,
    employees,
    locations,
    logs,
    maintenance,
    notifications,
    reports,
    roles,
    transfers,
)

logger = logging.getLogger("assetflow")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AssetFlow API starting up")
    yield
    logger.info("AssetFlow API shutting down")


app = FastAPI(
    title="AssetFlow API",
    description="Enterprise Asset & Resource Management System",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth.router)
app.include_router(departments.router)
app.include_router(categories.router)
app.include_router(locations.router)
app.include_router(employees.router)
app.include_router(roles.router)
app.include_router(assets.router)
app.include_router(attachments.router)
app.include_router(allocations.router)
app.include_router(transfers.router)
app.include_router(bookings.router)
app.include_router(maintenance.router)
app.include_router(audits.router)
app.include_router(discrepancies.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(notifications.router)
app.include_router(logs.router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
