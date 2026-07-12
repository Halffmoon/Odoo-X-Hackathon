from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.employee import Employee
from app.schemas.dashboard import DashboardKPIs
from app.services import dashboard_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/kpis", response_model=DashboardKPIs)
async def kpis(
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    return await dashboard_service.get_kpis(db, actor)
