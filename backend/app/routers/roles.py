from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.employee import Employee
from app.schemas.employee import RoleResponse
from app.services import employee_service

router = APIRouter(prefix="/api/roles", tags=["roles"])


@router.get("", response_model=list[RoleResponse])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(get_current_user),
):
    return await employee_service.list_roles(db)
