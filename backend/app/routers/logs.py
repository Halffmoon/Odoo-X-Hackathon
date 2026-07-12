import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles
from app.models.employee import Employee
from app.schemas.dashboard import ActivityLogResponse
from app.services import log_service

router = APIRouter(prefix="/api/logs", tags=["logs"])

MANAGER = ("ADMIN", "ASSET_MANAGER")


@router.get("", response_model=list[ActivityLogResponse])
async def list_logs(
    entity_table: str | None = None,
    actor_user_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(require_roles(*MANAGER)),
):
    return await log_service.list_logs(
        db, entity_table=entity_table, actor_user_id=actor_user_id,
        date_from=date_from, date_to=date_to, limit=limit, offset=offset,
    )


@router.get("/{entity_table}/{entity_id}", response_model=list[ActivityLogResponse])
async def entity_logs(
    entity_table: str,
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Employee = Depends(require_roles(*MANAGER)),
):
    return await log_service.list_entity_logs(db, entity_table, entity_id)
