import uuid
from datetime import date, datetime, time, timedelta, timezone


def _effective_status(stored: str, start: datetime, end: datetime) -> str:
    """Compute UPCOMING/ONGOING/COMPLETED at read time.

    Terminal states (CANCELLED, COMPLETED) are returned as-is; otherwise the
    status is derived from the clock so it never drifts without a background job.
    """
    if stored in ("CANCELLED", "COMPLETED"):
        return stored
    now = datetime.now(timezone.utc)
    if now < start:
        return "UPCOMING"
    if start <= now < end:
        return "ONGOING"
    return "COMPLETED"

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.booking import Booking, BookingHistory
from app.models.department import Department
from app.models.employee import Employee
from app.schemas.booking import AvailabilityResponse, BookingResponse, TimeSlot
from app.utils.activity_logger import log_activity
from app.utils.notification_helper import create_notification

ACTIVE_BOOKING_STATUSES = ("UPCOMING", "ONGOING")


async def _asset_or_404(db: AsyncSession, asset_id: uuid.UUID) -> Asset:
    asset = (
        await db.execute(
            select(Asset).where(
                Asset.asset_id == asset_id, Asset.is_deleted.is_(False)
            )
        )
    ).scalar_one_or_none()
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found.")
    return asset


async def _hydrate(db: AsyncSession, b: Booking) -> BookingResponse:
    asset_name = (
        await db.execute(select(Asset.name).where(Asset.asset_id == b.asset_id))
    ).scalar_one_or_none()
    emp_name = (
        await db.execute(
            select(Employee.name).where(Employee.employee_id == b.employee_id)
        )
    ).scalar_one_or_none()
    dept_name = None
    if b.department_id:
        dept_name = (
            await db.execute(
                select(Department.name).where(
                    Department.department_id == b.department_id
                )
            )
        ).scalar_one_or_none()
    return BookingResponse(
        booking_id=b.booking_id,
        asset_id=b.asset_id,
        asset_name=asset_name,
        employee_id=b.employee_id,
        employee_name=emp_name,
        department_id=b.department_id,
        department_name=dept_name,
        start_time=b.start_time,
        end_time=b.end_time,
        status=_effective_status(b.status, b.start_time, b.end_time),
        purpose=b.purpose,
    )


async def check_availability(
    db: AsyncSession, asset_id: uuid.UUID, on_date: date
) -> AvailabilityResponse:
    await _asset_or_404(db, asset_id)
    day_start = datetime.combine(on_date, time.min, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    rows = (
        await db.execute(
            select(Booking, Employee.name)
            .join(Employee, Employee.employee_id == Booking.employee_id, isouter=True)
            .where(
                Booking.asset_id == asset_id,
                Booking.status != "CANCELLED",
                Booking.start_time < day_end,
                Booking.end_time > day_start,
            )
            .order_by(Booking.start_time)
        )
    ).all()

    booked: list[TimeSlot] = []
    for b, name in rows:
        booked.append(
            TimeSlot(
                start=max(b.start_time, day_start),
                end=min(b.end_time, day_end),
                booked_by=name,
                booking_id=b.booking_id,
            )
        )

    # Compute free gaps between booked slots within the day.
    free: list[TimeSlot] = []
    cursor = day_start
    for slot in booked:
        if slot.start > cursor:
            free.append(TimeSlot(start=cursor, end=slot.start))
        cursor = max(cursor, slot.end)
    if cursor < day_end:
        free.append(TimeSlot(start=cursor, end=day_end))

    return AvailabilityResponse(
        asset_id=asset_id, date=on_date, booked_slots=booked, free_slots=free
    )


async def _find_conflict(
    db: AsyncSession,
    asset_id: uuid.UUID,
    start: datetime,
    end: datetime,
    exclude_booking_id: uuid.UUID | None = None,
) -> tuple[Booking, str | None] | None:
    stmt = (
        select(Booking, Employee.name)
        .join(Employee, Employee.employee_id == Booking.employee_id, isouter=True)
        .where(
            Booking.asset_id == asset_id,
            Booking.status.in_(ACTIVE_BOOKING_STATUSES),
            Booking.start_time < end,
            Booking.end_time > start,
        )
    )
    if exclude_booking_id:
        stmt = stmt.where(Booking.booking_id != exclude_booking_id)
    row = (await db.execute(stmt.limit(1))).first()
    return (row[0], row[1]) if row else None


def _conflict_detail(asset_tag, conflict: Booking, name: str | None, req_start, req_end):
    def fmt(dt: datetime) -> str:
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M")
    who = name or "another user"
    return {
        "message": f"{asset_tag} is booked {fmt(conflict.start_time)}–{fmt(conflict.end_time)} "
        f"by {who}. Your request {fmt(req_start)}–{fmt(req_end)} overlaps.",
        "conflicting_booking_id": str(conflict.booking_id),
    }


async def create_booking(
    db: AsyncSession, data, actor: Employee, ip: str | None
) -> BookingResponse:
    asset = await _asset_or_404(db, data.asset_id)
    if not asset.is_bookable:
        raise HTTPException(
            status_code=400, detail=f"Asset {asset.asset_tag} is not bookable."
        )
    # Capture before flush: a constraint failure + rollback expires `asset`, and
    # touching its attributes afterwards would trigger a sync lazy-load.
    asset_tag = asset.asset_tag
    asset_name = asset.name

    booking = Booking(
        asset_id=data.asset_id,
        employee_id=actor.employee_id,
        start_time=data.start_time,
        end_time=data.end_time,
        purpose=data.purpose,
        created_by=actor.user_id,
        updated_by=actor.user_id,
    )
    db.add(booking)
    try:
        # Flush fires fn_backfill_booking_department and the no_overlapping_bookings
        # EXCLUDE constraint.
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        if "no_overlapping_bookings" in str(getattr(exc, "orig", exc)):
            conflict = await _find_conflict(
                db, data.asset_id, data.start_time, data.end_time
            )
            if conflict:
                raise HTTPException(
                    status_code=409,
                    detail=_conflict_detail(
                        asset_tag, conflict[0], conflict[1],
                        data.start_time, data.end_time,
                    ),
                )
            raise HTTPException(status_code=409, detail="Booking overlaps an existing one.")
        raise HTTPException(
            status_code=409, detail=f"Could not create booking: {getattr(exc, 'orig', exc)}"
        )

    db.add(
        BookingHistory(
            booking_id=booking.booking_id,
            action="CREATED",
            performed_by=actor.employee_id,
        )
    )
    await create_notification(
        db, actor.employee_id, "BOOKING_CONFIRMED",
        "Booking confirmed",
        f"Your booking of {asset_name} is confirmed.",
        "bookings", booking.booking_id,
    )
    await log_activity(
        db, actor.user_id, "CREATE_BOOKING", "bookings", booking.booking_id,
        new_value={"asset_id": str(data.asset_id)}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(booking)
    return await _hydrate(db, booking)


async def _get_or_404(db: AsyncSession, booking_id: uuid.UUID) -> Booking:
    b = (
        await db.execute(select(Booking).where(Booking.booking_id == booking_id))
    ).scalar_one_or_none()
    if b is None:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return b


def _can_manage(booking: Booking, actor: Employee) -> bool:
    if booking.employee_id == actor.employee_id:
        return True
    if actor.role.role_code in ("ADMIN", "ASSET_MANAGER"):
        return True
    # Dept head over the booking's department.
    if (
        actor.role.role_code == "DEPT_HEAD"
        and booking.department_id is not None
        and booking.department_id == actor.department_id
    ):
        return True
    return False


async def reschedule(
    db: AsyncSession, booking_id: uuid.UUID, data, actor: Employee, ip: str | None
) -> BookingResponse:
    booking = await _get_or_404(db, booking_id)
    if not _can_manage(booking, actor):
        raise HTTPException(status_code=403, detail="Not allowed to reschedule this booking.")
    if booking.status != "UPCOMING":
        raise HTTPException(
            status_code=409,
            detail=f"Only UPCOMING bookings can be rescheduled (this is {booking.status}).",
        )

    asset = await _asset_or_404(db, booking.asset_id)
    asset_tag = asset.asset_tag
    asset_id = booking.asset_id
    booking.start_time = data.start_time
    booking.end_time = data.end_time
    booking.updated_by = actor.user_id
    booking.updated_on = datetime.now(timezone.utc)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        if "no_overlapping_bookings" in str(getattr(exc, "orig", exc)):
            conflict = await _find_conflict(
                db, asset_id, data.start_time, data.end_time,
                exclude_booking_id=booking_id,
            )
            if conflict:
                raise HTTPException(
                    status_code=409,
                    detail=_conflict_detail(
                        asset_tag, conflict[0], conflict[1],
                        data.start_time, data.end_time,
                    ),
                )
        raise HTTPException(status_code=409, detail="Reschedule overlaps an existing booking.")

    db.add(
        BookingHistory(
            booking_id=booking.booking_id,
            action="RESCHEDULED",
            performed_by=actor.employee_id,
        )
    )
    await log_activity(
        db, actor.user_id, "RESCHEDULE_BOOKING", "bookings", booking.booking_id,
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(booking)
    return await _hydrate(db, booking)


async def cancel(
    db: AsyncSession, booking_id: uuid.UUID, actor: Employee, ip: str | None
) -> BookingResponse:
    booking = await _get_or_404(db, booking_id)
    if not _can_manage(booking, actor):
        raise HTTPException(status_code=403, detail="Not allowed to cancel this booking.")
    if booking.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(
            status_code=409, detail=f"Booking is already {booking.status}."
        )
    booking.status = "CANCELLED"
    booking.updated_by = actor.user_id
    booking.updated_on = datetime.now(timezone.utc)
    db.add(
        BookingHistory(
            booking_id=booking.booking_id,
            action="CANCELLED",
            performed_by=actor.employee_id,
        )
    )
    await create_notification(
        db, booking.employee_id, "BOOKING_CANCELLED",
        "Booking cancelled",
        "Your booking has been cancelled.",
        "bookings", booking.booking_id,
    )
    await log_activity(
        db, actor.user_id, "CANCEL_BOOKING", "bookings", booking.booking_id, ip_address=ip
    )
    await db.commit()
    await db.refresh(booking)
    return await _hydrate(db, booking)


async def list_bookings(
    db: AsyncSession,
    *,
    asset_id: uuid.UUID | None = None,
    employee_id: uuid.UUID | None = None,
    department_id: uuid.UUID | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[BookingResponse], int]:
    filters = []
    if asset_id:
        filters.append(Booking.asset_id == asset_id)
    if employee_id:
        filters.append(Booking.employee_id == employee_id)
    if department_id:
        filters.append(Booking.department_id == department_id)
    if status:
        filters.append(Booking.status == status)
    if date_from:
        filters.append(Booking.end_time >= date_from)
    if date_to:
        filters.append(Booking.start_time <= date_to)
    total = (
        await db.execute(select(func.count()).select_from(Booking).where(*filters))
    ).scalar_one()
    stmt = (
        select(Booking)
        .where(*filters)
        .order_by(Booking.start_time.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [await _hydrate(db, b) for b in rows], total


async def get_booking(db: AsyncSession, booking_id: uuid.UUID) -> BookingResponse:
    return await _hydrate(db, await _get_or_404(db, booking_id))


async def get_history(
    db: AsyncSession, booking_id: uuid.UUID
) -> list[BookingHistory]:
    await _get_or_404(db, booking_id)
    result = await db.execute(
        select(BookingHistory)
        .where(BookingHistory.booking_id == booking_id)
        .order_by(BookingHistory.performed_on.desc())
    )
    return list(result.scalars().all())
