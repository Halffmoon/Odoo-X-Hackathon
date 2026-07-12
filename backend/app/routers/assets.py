import uuid

from fastapi import APIRouter, Depends, File, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.schemas.asset import (
    AssetCreate,
    AssetHistoryEvent,
    AssetResponse,
    AssetStatusHistoryResponse,
    AssetStatusUpdate,
    AssetUpdate,
    AttachmentResponse,
    CustomFieldValueResponse,
    CustomFieldValuesUpdate,
)
from app.schemas.common import MessageResponse
from app.schemas.pagination import PaginatedResponse, PaginationParams
from app.services import asset_service
from app.utils.file_storage import infer_file_type, save_upload

router = APIRouter(prefix="/api/assets", tags=["assets"])

MANAGER = ("ADMIN", "ASSET_MANAGER")


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=PaginatedResponse[AssetResponse])
async def list_assets(
    q: str | None = None,
    serial_number: str | None = None,
    category_id: uuid.UUID | None = None,
    status: str | None = None,
    department_id: uuid.UUID | None = None,
    location_id: uuid.UUID | None = None,
    qr_code: str | None = None,
    is_bookable: bool | None = None,
    page: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    items, total = await asset_service.search_assets(
        db, q=q, serial_number=serial_number, category_id=category_id,
        status=status, department_id=department_id, location_id=location_id,
        qr_code=qr_code, is_bookable=is_bookable, limit=page.limit, offset=page.offset,
    )
    return PaginatedResponse.build(items, total, page)


@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
async def register_asset(
    data: AssetCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    return await asset_service.register_asset(db, data, actor, _ip(request))


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await asset_service.get_asset(db, asset_id)


@router.put("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: uuid.UUID,
    data: AssetUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    return await asset_service.update_asset(db, asset_id, data, actor, _ip(request))


@router.delete("/{asset_id}", response_model=MessageResponse)
async def delete_asset(
    asset_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    await asset_service.delete_asset(db, asset_id, actor, _ip(request))
    return MessageResponse(message="Asset deleted.")


@router.patch("/{asset_id}/status", response_model=AssetResponse)
async def change_status(
    asset_id: uuid.UUID,
    data: AssetStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    return await asset_service.change_status(
        db, asset_id, data.new_status, data.reason, actor, _ip(request)
    )


@router.get(
    "/{asset_id}/status-history", response_model=list[AssetStatusHistoryResponse]
)
async def status_history(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await asset_service.get_status_history(db, asset_id)


@router.get("/{asset_id}/history", response_model=list[AssetHistoryEvent])
async def combined_history(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await asset_service.get_combined_history(db, asset_id)


# ---------------- custom field values ----------------

@router.get("/{asset_id}/fields", response_model=list[CustomFieldValueResponse])
async def get_fields(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await asset_service.get_field_values(db, asset_id)


@router.put("/{asset_id}/fields", response_model=list[CustomFieldValueResponse])
async def put_fields(
    asset_id: uuid.UUID,
    data: CustomFieldValuesUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    return await asset_service.upsert_field_values(
        db, asset_id, data.values, actor, _ip(request)
    )


# ---------------- attachments ----------------

@router.get("/{asset_id}/attachments", response_model=list[AttachmentResponse])
async def list_attachments(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await asset_service.list_attachments(db, asset_id)


@router.post(
    "/{asset_id}/attachments",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_attachment(
    asset_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    file_url = await save_upload("assets", file)
    return await asset_service.add_attachment(
        db, asset_id, file_url, infer_file_type(file), actor, _ip(request)
    )
