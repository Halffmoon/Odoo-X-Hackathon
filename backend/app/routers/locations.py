import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.schemas.common import MessageResponse
from app.schemas.location import LocationCreate, LocationResponse, LocationUpdate
from app.services import location_service

router = APIRouter(prefix="/api/locations", tags=["locations"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=list[LocationResponse])
async def list_locations(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await location_service.list_locations(db, include_inactive)


@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    data: LocationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    return await location_service.create_location(db, data, actor, _ip(request))


@router.put("/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: uuid.UUID,
    data: LocationUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    return await location_service.update_location(
        db, location_id, data, actor, _ip(request)
    )


@router.delete("/{location_id}", response_model=MessageResponse)
async def deactivate_location(
    location_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    await location_service.deactivate_location(db, location_id, actor, _ip(request))
    return MessageResponse(message="Location deactivated.")
