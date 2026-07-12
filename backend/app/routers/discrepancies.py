import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.schemas.audit import DiscrepancyResponse, ResolveDiscrepancyRequest
from app.services import audit_service

router = APIRouter(prefix="/api/discrepancies", tags=["discrepancies"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=list[DiscrepancyResponse])
async def list_discrepancies(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await audit_service.list_discrepancies(db, status)


@router.get("/{discrepancy_id}", response_model=DiscrepancyResponse)
async def get_discrepancy(
    discrepancy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await audit_service.get_discrepancy(db, discrepancy_id)


@router.post("/{discrepancy_id}/resolve", response_model=DiscrepancyResponse)
async def resolve_discrepancy(
    discrepancy_id: uuid.UUID,
    data: ResolveDiscrepancyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN", "ASSET_MANAGER")),
):
    return await audit_service.resolve_discrepancy(
        db, discrepancy_id, data.resolution_notes, actor, _ip(request)
    )
