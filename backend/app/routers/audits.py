import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.schemas.audit import (
    AuditAssignmentResponse,
    AuditCycleCreate,
    AuditCycleResponse,
    AuditorRequest,
    AuditResultCreate,
    AuditResultResponse,
)
from app.schemas.common import MessageResponse
from app.services import audit_service

router = APIRouter(prefix="/api/audits", tags=["audits"])

MANAGER = ("ADMIN", "ASSET_MANAGER")


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=list[AuditCycleResponse])
async def list_cycles(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await audit_service.list_cycles(db, status)


@router.get("/{cycle_id}", response_model=AuditCycleResponse)
async def get_cycle(
    cycle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await audit_service.get_cycle(db, cycle_id)


@router.post("", response_model=AuditCycleResponse, status_code=status.HTTP_201_CREATED)
async def create_cycle(
    data: AuditCycleCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    return await audit_service.create_cycle(db, data, actor, _ip(request))


@router.post("/{cycle_id}/close", response_model=AuditCycleResponse)
async def close_cycle(
    cycle_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    return await audit_service.close_cycle(db, cycle_id, actor, _ip(request))


@router.get("/{cycle_id}/results", response_model=list[AuditResultResponse])
async def list_results(
    cycle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await audit_service.list_results(db, cycle_id)


@router.post(
    "/{cycle_id}/results",
    response_model=AuditResultResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_finding(
    cycle_id: uuid.UUID,
    data: AuditResultCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    return await audit_service.record_finding(db, cycle_id, data, actor, _ip(request))


@router.get("/{cycle_id}/auditors", response_model=list[AuditAssignmentResponse])
async def list_auditors(
    cycle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await audit_service.list_auditors(db, cycle_id)


@router.post(
    "/{cycle_id}/auditors",
    response_model=AuditAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_auditor(
    cycle_id: uuid.UUID,
    data: AuditorRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    return await audit_service.add_auditor(
        db, cycle_id, data.auditor_employee_id, actor, _ip(request)
    )


@router.delete("/{cycle_id}/auditors/{employee_id}", response_model=MessageResponse)
async def remove_auditor(
    cycle_id: uuid.UUID,
    employee_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles(*MANAGER)),
):
    await audit_service.remove_auditor(db, cycle_id, employee_id, actor, _ip(request))
    return MessageResponse(message="Auditor removed.")
