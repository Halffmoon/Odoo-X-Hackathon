import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles
from app.models.employee import Employee
from app.schemas.dashboard import (
    BookingHeatmap,
    DepartmentSummaryRow,
    MaintenanceFrequencyRow,
    RetirementForecastRow,
    UtilizationRow,
)
from app.services import report_service

router = APIRouter(prefix="/api/reports", tags=["reports"])

MANAGER = ("ADMIN", "ASSET_MANAGER")


@router.get("/utilization", response_model=list[UtilizationRow])
async def utilization(
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(require_roles(*MANAGER)),
):
    return await report_service.utilization(db)


@router.get("/maintenance-frequency", response_model=list[MaintenanceFrequencyRow])
async def maintenance_frequency(
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(require_roles(*MANAGER)),
):
    return await report_service.maintenance_frequency(db)


@router.get("/department-summary", response_model=list[DepartmentSummaryRow])
async def department_summary(
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(require_roles(*MANAGER)),
):
    return await report_service.department_summary(db)


@router.get("/booking-heatmap", response_model=BookingHeatmap)
async def booking_heatmap(
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(require_roles(*MANAGER)),
):
    return await report_service.booking_heatmap(db)


@router.get("/retirement-forecast", response_model=list[RetirementForecastRow])
async def retirement_forecast(
    older_than_years: int = 5,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(require_roles(*MANAGER)),
):
    return await report_service.retirement_forecast(db, older_than_years)


@router.get("/export")
async def export(
    type: str = Query(..., description="utilization|maintenance-frequency|department-summary|retirement-forecast"),
    format: str = Query("xlsx", description="xlsx|pdf"),
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(require_roles(*MANAGER)),
):
    try:
        content, media_type, filename = await report_service.export_report(
            db, type, format
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
