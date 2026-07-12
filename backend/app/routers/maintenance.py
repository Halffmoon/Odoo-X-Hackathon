import uuid

from fastapi import APIRouter, Depends, File, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.schemas.asset import AttachmentResponse
from app.schemas.maintenance import (
    AssignTechnicianRequest,
    MaintenanceCreate,
    MaintenanceHistoryResponse,
    MaintenanceResponse,
    RejectRequest,
    ResolveRequest,
)
from app.schemas.pagination import PaginatedResponse, PaginationParams
from app.services import maintenance_service
from app.utils.file_storage import infer_file_type, save_upload

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])

MANAGER = ("ADMIN", "ASSET_MANAGER")


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=PaginatedResponse[MaintenanceResponse])
async def list_requests(
    asset_id: uuid.UUID | None = None,
    status: str | None = None,
    priority: str | None = None,
    technician_id: uuid.UUID | None = None,
    page: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    items, total = await maintenance_service.list_requests(
        db, asset_id=asset_id, status=status, priority=priority,
        technician_id=technician_id, limit=page.limit, offset=page.offset,
    )
    return PaginatedResponse.build(items, total, page)


@router.get("/{maintenance_id}", response_model=MaintenanceResponse)
async def get_request(
    maintenance_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await maintenance_service.get_request(db, maintenance_id)


@router.get("/{maintenance_id}/history", response_model=list[MaintenanceHistoryResponse])
async def history(
    maintenance_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await maintenance_service.get_history(db, maintenance_id)


@router.post("", response_model=MaintenanceResponse, status_code=status.HTTP_201_CREATED)
async def raise_request(
    data: MaintenanceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    return await maintenance_service.raise_request(db, data, actor, _ip(request))


@router.post("/{maintenance_id}/approve", response_model=MaintenanceResponse)
async def approve(
    maintenance_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    return await maintenance_service.approve(db, maintenance_id, actor, _ip(request))


@router.post("/{maintenance_id}/reject", response_model=MaintenanceResponse)
async def reject(
    maintenance_id: uuid.UUID,
    data: RejectRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    return await maintenance_service.reject(
        db, maintenance_id, data.reason, actor, _ip(request)
    )


@router.post("/{maintenance_id}/assign-technician", response_model=MaintenanceResponse)
async def assign_technician(
    maintenance_id: uuid.UUID,
    data: AssignTechnicianRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    return await maintenance_service.assign_technician(
        db, maintenance_id, data.technician_id, actor, _ip(request)
    )


@router.post("/{maintenance_id}/start", response_model=MaintenanceResponse)
async def start(
    maintenance_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    return await maintenance_service.start(db, maintenance_id, actor, _ip(request))


@router.post("/{maintenance_id}/resolve", response_model=MaintenanceResponse)
async def resolve(
    maintenance_id: uuid.UUID,
    data: ResolveRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    return await maintenance_service.resolve(
        db, maintenance_id, data.resolution_notes, actor, _ip(request)
    )


@router.get("/{maintenance_id}/attachments", response_model=list[AttachmentResponse])
async def list_attachments(
    maintenance_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await maintenance_service.list_attachments(db, maintenance_id)


@router.post(
    "/{maintenance_id}/attachments",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_attachment(
    maintenance_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    file_url = await save_upload("maintenance", file)
    return await maintenance_service.add_attachment(
        db, maintenance_id, file_url, infer_file_type(file), actor, _ip(request)
    )
