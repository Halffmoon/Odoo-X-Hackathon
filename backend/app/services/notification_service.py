import uuid

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee
from app.models.notification import Notification
from app.schemas.dashboard import NotificationList, NotificationResponse


async def list_notifications(
    db: AsyncSession,
    actor: Employee,
    is_read: bool | None = None,
    limit: int = 50,
    offset: int = 0,
) -> NotificationList:
    base = select(Notification).where(
        Notification.recipient_employee_id == actor.employee_id
    )
    if is_read is not None:
        base = base.where(Notification.is_read.is_(is_read))

    total = (
        await db.execute(
            select(func.count()).select_from(base.subquery())
        )
    ).scalar_one()
    unread = (
        await db.execute(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.recipient_employee_id == actor.employee_id,
                Notification.is_read.is_(False),
            )
        )
    ).scalar_one()

    rows = (
        await db.execute(
            base.order_by(Notification.created_on.desc()).limit(limit).offset(offset)
        )
    ).scalars().all()

    return NotificationList(
        unread_count=unread,
        total=total,
        items=[NotificationResponse.model_validate(n) for n in rows],
    )


async def mark_read(
    db: AsyncSession, notification_id: uuid.UUID, actor: Employee
) -> NotificationResponse:
    n = (
        await db.execute(
            select(Notification).where(
                Notification.notification_id == notification_id
            )
        )
    ).scalar_one_or_none()
    if n is None:
        raise HTTPException(status_code=404, detail="Notification not found.")
    if n.recipient_employee_id != actor.employee_id:
        raise HTTPException(status_code=403, detail="Not your notification.")
    n.is_read = True
    await db.commit()
    await db.refresh(n)
    return NotificationResponse.model_validate(n)


async def mark_all_read(db: AsyncSession, actor: Employee) -> int:
    result = await db.execute(
        update(Notification)
        .where(
            Notification.recipient_employee_id == actor.employee_id,
            Notification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    await db.commit()
    return result.rowcount or 0
