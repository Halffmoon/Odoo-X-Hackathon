import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee
from app.models.notification import ActivityLog
from app.models.user import User
from app.schemas.dashboard import ActivityLogResponse


def _to_response(log: ActivityLog, actor_name: str | None) -> ActivityLogResponse:
    return ActivityLogResponse(
        log_id=log.log_id,
        actor_user_id=log.actor_user_id,
        actor_name=actor_name,
        action=log.action,
        entity_table=log.entity_table,
        entity_id=log.entity_id,
        old_value=log.old_value,
        new_value=log.new_value,
        ip_address=log.ip_address,
        created_on=log.created_on,
    )


def _base_query():
    # Actor name comes from employees via the user link.
    return (
        select(ActivityLog, Employee.name)
        .join(User, User.user_id == ActivityLog.actor_user_id, isouter=True)
        .join(Employee, Employee.user_id == User.user_id, isouter=True)
    )


async def list_logs(
    db: AsyncSession,
    *,
    entity_table: str | None = None,
    actor_user_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[ActivityLogResponse]:
    stmt = _base_query()
    if entity_table:
        stmt = stmt.where(ActivityLog.entity_table == entity_table)
    if actor_user_id:
        stmt = stmt.where(ActivityLog.actor_user_id == actor_user_id)
    if date_from:
        stmt = stmt.where(ActivityLog.created_on >= date_from)
    if date_to:
        stmt = stmt.where(ActivityLog.created_on <= date_to)
    stmt = stmt.order_by(ActivityLog.created_on.desc()).limit(limit).offset(offset)
    rows = (await db.execute(stmt)).all()
    return [_to_response(log, name) for log, name in rows]


async def list_entity_logs(
    db: AsyncSession, entity_table: str, entity_id: uuid.UUID
) -> list[ActivityLogResponse]:
    stmt = (
        _base_query()
        .where(
            ActivityLog.entity_table == entity_table,
            ActivityLog.entity_id == entity_id,
        )
        .order_by(ActivityLog.created_on.desc())
    )
    rows = (await db.execute(stmt)).all()
    return [_to_response(log, name) for log, name in rows]
