import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import ActivityLog


async def log_activity(
    db: AsyncSession,
    actor_user_id: uuid.UUID | None,
    action: str,
    entity_table: str | None = None,
    entity_id: uuid.UUID | None = None,
    old_value: dict | None = None,
    new_value: dict | None = None,
    ip_address: str | None = None,
) -> ActivityLog:
    """Append a row to activity_logs. Call inside every write operation.

    The row is added to the session but not committed here — the caller's
    transaction commits it, keeping the log atomic with the change it records.
    """
    log = ActivityLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_table=entity_table,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        ip_address=ip_address,
    )
    db.add(log)
    return log
