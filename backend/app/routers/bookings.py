import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.employee import Employee
from app.schemas.booking import (
    AvailabilityResponse,
    BookingCreate,
    BookingHistoryResponse,
    BookingReschedule,
    BookingResponse,
)
from app.schemas.common import MessageResponse
from app.schemas.pagination import PaginatedResponse, PaginationParams
from app.services import booking_service

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=PaginatedResponse[BookingResponse])
async def list_bookings(
    asset_id: uuid.UUID | None = None,
    employee_id: uuid.UUID | None = None,
    department_id: uuid.UUID | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    items, total = await booking_service.list_bookings(
        db, asset_id=asset_id, employee_id=employee_id, department_id=department_id,
        status=status, date_from=date_from, date_to=date_to,
        limit=page.limit, offset=page.offset,
    )
    return PaginatedResponse.build(items, total, page)


@router.get("/availability", response_model=AvailabilityResponse)
async def availability(
    asset_id: uuid.UUID,
    date: date,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await booking_service.check_availability(db, asset_id, date)


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await booking_service.get_booking(db, booking_id)


@router.get("/{booking_id}/history", response_model=list[BookingHistoryResponse])
async def booking_history(
    booking_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await booking_service.get_history(db, booking_id)


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    data: BookingCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    return await booking_service.create_booking(db, data, actor, _ip(request))


@router.put("/{booking_id}/reschedule", response_model=BookingResponse)
async def reschedule(
    booking_id: uuid.UUID,
    data: BookingReschedule,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    return await booking_service.reschedule(db, booking_id, data, actor, _ip(request))


@router.post("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel(
    booking_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    return await booking_service.cancel(db, booking_id, actor, _ip(request))
