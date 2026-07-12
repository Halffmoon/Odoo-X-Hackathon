import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    recipient_employee_id: uuid.UUID,
    type: str,
    title: str,
    message: str,
    reference_table: str | None = None,
    reference_id: uuid.UUID | None = None,
) -> Notification:
    """Create an in-app notification for one recipient.

    Added to the session but not committed — the caller's transaction commits
    it alongside the change that triggered it.
    """
    notification = Notification(
        recipient_employee_id=recipient_employee_id,
        type=type,
        title=title,
        message=message,
        reference_table=reference_table,
        reference_id=reference_id,
    )
    db.add(notification)
    return notification
