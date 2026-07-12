import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.schemas.common import MessageResponse
from app.schemas.department import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentTreeNode,
    DepartmentUpdate,
)
from app.services import department_service

router = APIRouter(prefix="/api/departments", tags=["departments"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=list[DepartmentResponse])
async def list_departments(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await department_service.list_departments(db, include_inactive)


@router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await department_service.get_department(db, department_id)


@router.get("/{department_id}/hierarchy", response_model=DepartmentTreeNode)
async def get_hierarchy(
    department_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await department_service.get_hierarchy(db, department_id)


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    data: DepartmentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    return await department_service.create_department(db, data, actor, _ip(request))


@router.put("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: uuid.UUID,
    data: DepartmentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    return await department_service.update_department(
        db, department_id, data, actor, _ip(request)
    )


@router.delete("/{department_id}", response_model=MessageResponse)
async def deactivate_department(
    department_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    await department_service.deactivate_department(
        db, department_id, actor, _ip(request)
    )
    return MessageResponse(message="Department deactivated.")
