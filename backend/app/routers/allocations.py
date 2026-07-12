import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.schemas.allocation import (
    AllocationCreate,
    AllocationResponse,
    OverdueResponse,
    ReturnRequest,
)
from app.schemas.pagination import PaginatedResponse, PaginationParams
from app.services import allocation_service

router = APIRouter(prefix="/api/allocations", tags=["allocations"])

MANAGER = ("ADMIN", "ASSET_MANAGER", "DEPT_HEAD")


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=PaginatedResponse[AllocationResponse])
async def list_allocations(
    asset_id: uuid.UUID | None = None,
    employee_id: uuid.UUID | None = None,
    department_id: uuid.UUID | None = None,
    status: str | None = None,
    page: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    items, total = await allocation_service.list_allocations(
        db, asset_id=asset_id, employee_id=employee_id,
        department_id=department_id, status=status, limit=page.limit, offset=page.offset,
    )
    return PaginatedResponse.build(items, total, page)


@router.get("/overdue", response_model=list[OverdueResponse])
async def overdue(
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await allocation_service.list_overdue(db)


@router.get("/{allocation_id}", response_model=AllocationResponse)
async def get_allocation(
    allocation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await allocation_service.get_allocation(db, allocation_id)


@router.post("", response_model=AllocationResponse, status_code=status.HTTP_201_CREATED)
async def allocate(
    data: AllocationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    return await allocation_service.allocate(db, data, actor, _ip(request))


@router.post("/{allocation_id}/return", response_model=AllocationResponse)
async def return_asset(
    allocation_id: uuid.UUID,
    data: ReturnRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    return await allocation_service.return_asset(
        db, allocation_id, data, actor, _ip(request)
    )
