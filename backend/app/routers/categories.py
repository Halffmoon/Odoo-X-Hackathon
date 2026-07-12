import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.schemas.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    CustomFieldCreate,
    CustomFieldResponse,
    CustomFieldUpdate,
)
from app.schemas.common import MessageResponse
from app.services import category_service

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=list[CategoryResponse])
async def list_categories(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await category_service.list_categories(db, include_inactive)


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await category_service.get_category(db, category_id)


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    return await category_service.create_category(db, data, actor, _ip(request))


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: uuid.UUID,
    data: CategoryUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    return await category_service.update_category(
        db, category_id, data, actor, _ip(request)
    )


@router.delete("/{category_id}", response_model=MessageResponse)
async def delete_category(
    category_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    await category_service.delete_category(db, category_id, actor, _ip(request))
    return MessageResponse(message="Category deleted.")


# ---------------- custom fields ----------------

@router.get("/{category_id}/fields", response_model=list[CustomFieldResponse])
async def list_fields(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await category_service.list_fields(db, category_id)


@router.post(
    "/{category_id}/fields",
    response_model=CustomFieldResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_field(
    category_id: uuid.UUID,
    data: CustomFieldCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    return await category_service.create_field(db, category_id, data, actor, _ip(request))


@router.put("/{category_id}/fields/{field_id}", response_model=CustomFieldResponse)
async def update_field(
    category_id: uuid.UUID,
    field_id: uuid.UUID,
    data: CustomFieldUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    return await category_service.update_field(
        db, category_id, field_id, data, actor, _ip(request)
    )


@router.delete("/{category_id}/fields/{field_id}", response_model=MessageResponse)
async def delete_field(
    category_id: uuid.UUID,
    field_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    await category_service.delete_field(db, category_id, field_id, actor, _ip(request))
    return MessageResponse(message="Custom field deleted.")
