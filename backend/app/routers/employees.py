import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.schemas.common import MessageResponse
from app.schemas.employee import (
    EmployeeResponse,
    EmployeeUpdate,
    PromoteRequest,
    RoleHistoryResponse,
)
from app.services import employee_service

router = APIRouter(prefix="/api/employees", tags=["employees"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=list[EmployeeResponse])
async def list_employees(
    department_id: uuid.UUID | None = None,
    role_code: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await employee_service.list_employees(db, department_id, role_code, status)


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await employee_service.get_employee(db, employee_id)


@router.get("/{employee_id}/role-history", response_model=list[RoleHistoryResponse])
async def get_role_history(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await employee_service.get_role_history(db, employee_id)


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: uuid.UUID,
    data: EmployeeUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    return await employee_service.update_employee(
        db, employee_id, data, actor, _ip(request)
    )


@router.post("/{employee_id}/promote", response_model=EmployeeResponse)
async def promote_employee(
    employee_id: uuid.UUID,
    data: PromoteRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    return await employee_service.promote_employee(
        db, employee_id, data.new_role_code, actor, _ip(request)
    )


@router.delete("/{employee_id}", response_model=MessageResponse)
async def deactivate_employee(
    employee_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN")),
):
    await employee_service.deactivate_employee(db, employee_id, actor, _ip(request))
    return MessageResponse(message="Employee deactivated.")
