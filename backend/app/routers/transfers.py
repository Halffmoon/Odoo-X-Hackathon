import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.schemas.pagination import PaginatedResponse, PaginationParams
from app.schemas.transfer import (
    TransferActionRequest,
    TransferCreate,
    TransferResponse,
)
from app.services import transfer_service

router = APIRouter(prefix="/api/transfers", tags=["transfers"])

APPROVER = ("ADMIN", "ASSET_MANAGER", "DEPT_HEAD")


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=PaginatedResponse[TransferResponse])
async def list_transfers(
    asset_id: uuid.UUID | None = None,
    status: str | None = None,
    page: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    items, total = await transfer_service.list_transfers(
        db, asset_id=asset_id, status=status, limit=page.limit, offset=page.offset
    )
    return PaginatedResponse.build(items, total, page)


@router.get("/{transfer_id}", response_model=TransferResponse)
async def get_transfer(
    transfer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await transfer_service.get_transfer(db, transfer_id)


@router.post("", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
async def initiate(
    data: TransferCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    return await transfer_service.initiate(db, data, actor, _ip(request))


@router.post("/{transfer_id}/approve", response_model=TransferResponse)
async def approve(
    transfer_id: uuid.UUID,
    data: TransferActionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*APPROVER)),
):
    return await transfer_service.approve(db, transfer_id, data, actor, _ip(request))


@router.post("/{transfer_id}/reject", response_model=TransferResponse)
async def reject(
    transfer_id: uuid.UUID,
    data: TransferActionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*APPROVER)),
):
    return await transfer_service.reject(db, transfer_id, data, actor, _ip(request))
