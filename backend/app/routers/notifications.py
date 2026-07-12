import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.employee import Employee
from app.schemas.common import MessageResponse
from app.schemas.dashboard import NotificationList, NotificationResponse
from app.services import notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=NotificationList)
async def list_notifications(
    is_read: bool | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    return await notification_service.list_notifications(
        db, actor, is_read=is_read, limit=limit, offset=offset
    )


@router.post("/read-all", response_model=MessageResponse)
async def read_all(
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    count = await notification_service.mark_all_read(db, actor)
    return MessageResponse(message=f"Marked {count} notification(s) read.")


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(get_current_user),
):
    return await notification_service.mark_read(db, notification_id, actor)
