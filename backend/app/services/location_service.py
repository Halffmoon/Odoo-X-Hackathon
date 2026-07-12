import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.location import Location
from app.models.employee import Employee
from app.schemas.location import LocationCreate, LocationUpdate
from app.utils.activity_logger import log_activity


async def _get_or_404(db: AsyncSession, location_id: uuid.UUID) -> Location:
    result = await db.execute(
        select(Location).where(
            Location.location_id == location_id, Location.is_deleted.is_(False)
        )
    )
    loc = result.scalar_one_or_none()
    if loc is None:
        raise HTTPException(status_code=404, detail="Location not found.")
    return loc


async def list_locations(
    db: AsyncSession, include_inactive: bool = False
) -> list[Location]:
    stmt = select(Location).where(Location.is_deleted.is_(False))
    if not include_inactive:
        stmt = stmt.where(Location.status == "ACTIVE")
    result = await db.execute(stmt.order_by(Location.name))
    return list(result.scalars().all())


async def create_location(
    db: AsyncSession, data: LocationCreate, actor: Employee, ip: str | None
) -> Location:
    loc = Location(
        name=data.name,
        address=data.address,
        created_by=actor.user_id,
        updated_by=actor.user_id,
    )
    db.add(loc)
    await db.flush()
    await log_activity(
        db, actor.user_id, "CREATE_LOCATION", "locations", loc.location_id,
        new_value={"name": loc.name}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(loc)
    return loc


async def update_location(
    db: AsyncSession,
    location_id: uuid.UUID,
    data: LocationUpdate,
    actor: Employee,
    ip: str | None,
) -> Location:
    loc = await _get_or_404(db, location_id)
    for field in ("name", "address", "status"):
        value = getattr(data, field)
        if value is not None:
            setattr(loc, field, value)
    loc.updated_by = actor.user_id
    loc.updated_on = datetime.now(timezone.utc)
    await log_activity(
        db, actor.user_id, "UPDATE_LOCATION", "locations", loc.location_id,
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(loc)
    return loc


async def deactivate_location(
    db: AsyncSession, location_id: uuid.UUID, actor: Employee, ip: str | None
) -> None:
    loc = await _get_or_404(db, location_id)
    loc.is_deleted = True
    loc.status = "INACTIVE"
    loc.updated_by = actor.user_id
    loc.updated_on = datetime.now(timezone.utc)
    await log_activity(
        db, actor.user_id, "DEACTIVATE_LOCATION", "locations", loc.location_id,
        ip_address=ip,
    )
    await db.commit()
