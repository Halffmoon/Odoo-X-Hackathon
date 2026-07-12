import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.allocation import AllocationHistory, AssetAllocation
from app.models.asset import Asset
from app.models.department import Department
from app.models.employee import Employee, Role
from app.schemas.allocation import AllocationResponse
from app.utils.activity_logger import log_activity
from app.utils.notification_helper import create_notification


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


async def _employee_name(db: AsyncSession, employee_id: uuid.UUID | None) -> str | None:
    if employee_id is None:
        return None
    return (
        await db.execute(
            select(Employee.name).where(Employee.employee_id == employee_id)
        )
    ).scalar_one_or_none()


async def _department_name(
    db: AsyncSession, department_id: uuid.UUID | None
) -> str | None:
    if department_id is None:
        return None
    return (
        await db.execute(
            select(Department.name).where(Department.department_id == department_id)
        )
    ).scalar_one_or_none()


async def _hydrate(db: AsyncSession, alloc: AssetAllocation) -> AllocationResponse:
    asset = (
        await db.execute(select(Asset).where(Asset.asset_id == alloc.asset_id))
    ).scalar_one_or_none()
    days_overdue = None
    if alloc.status == "ACTIVE" and alloc.expected_return_date:
        delta = (date.today() - alloc.expected_return_date).days
        days_overdue = delta if delta > 0 else None
    return AllocationResponse(
        allocation_id=alloc.allocation_id,
        asset_id=alloc.asset_id,
        asset_tag=asset.asset_tag if asset else None,
        asset_name=asset.name if asset else None,
        employee_id=alloc.employee_id,
        employee_name=await _employee_name(db, alloc.employee_id),
        department_id=alloc.department_id,
        department_name=await _department_name(db, alloc.department_id),
        allocation_date=alloc.allocation_date,
        expected_return_date=alloc.expected_return_date,
        actual_return_date=alloc.actual_return_date,
        return_condition=alloc.return_condition,
        return_notes=alloc.return_notes,
        status=alloc.status,
        days_overdue=days_overdue,
    )


async def _asset_manager_ids(db: AsyncSession) -> list[uuid.UUID]:
    rows = (
        await db.execute(
            select(Employee.employee_id)
            .join(Role, Role.role_id == Employee.role_id)
            .where(
                Role.role_code == "ASSET_MANAGER",
                Employee.is_deleted.is_(False),
                Employee.status == "ACTIVE",
            )
        )
    ).scalars().all()
    return list(rows)


async def allocate(
    db: AsyncSession, data, actor: Employee, ip: str | None
) -> AllocationResponse:
    asset = await _asset_or_404(db, data.asset_id)

    if data.expected_return_date and data.expected_return_date < date.today():
        raise HTTPException(
            status_code=422,
            detail="expected_return_date must be on or after today (the allocation date).",
        )

    if asset.status not in ("AVAILABLE", "RESERVED"):
        # If already allocated, surface the current holder.
        if asset.status == "ALLOCATED":
            await _raise_active_conflict(db, asset)
        raise HTTPException(
            status_code=409,
            detail=f"Asset {asset.asset_tag} is {asset.status}; cannot allocate.",
        )

    alloc = AssetAllocation(
        asset_id=data.asset_id,
        employee_id=data.employee_id,
        department_id=data.department_id,
        expected_return_date=data.expected_return_date,
        status="ACTIVE",
        allocated_by=actor.employee_id,
    )
    db.add(alloc)
    try:
        # Flush triggers the uq_one_active_allocation index + the status-sync trigger.
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        detail = str(getattr(exc, "orig", exc))
        if "uq_one_active_allocation" in detail:
            asset = await _asset_or_404(db, data.asset_id)
            await _raise_active_conflict(db, asset)
        if "ck_alloc_expected_return" in detail:
            raise HTTPException(
                status_code=422,
                detail="expected_return_date must be on or after the allocation date.",
            )
        raise HTTPException(
            status_code=409, detail=f"Could not allocate asset: {detail}"
        )

    db.add(
        AllocationHistory(
            allocation_id=alloc.allocation_id,
            action="ALLOCATED",
            performed_by=actor.employee_id,
            details={
                "employee_id": str(data.employee_id) if data.employee_id else None,
                "department_id": str(data.department_id) if data.department_id else None,
            },
        )
    )

    # Notify the recipient (employee, else the department head if any).
    recipient = data.employee_id
    if recipient is None and data.department_id:
        recipient = (
            await db.execute(
                select(Department.head_employee_id).where(
                    Department.department_id == data.department_id
                )
            )
        ).scalar_one_or_none()
    if recipient:
        await create_notification(
            db, recipient, "ALLOCATION",
            "Asset allocated to you",
            f"Asset {asset.asset_tag} ({asset.name}) has been allocated to you.",
            "asset_allocations", alloc.allocation_id,
        )

    await log_activity(
        db, actor.user_id, "ALLOCATE_ASSET", "asset_allocations", alloc.allocation_id,
        new_value={"asset_tag": asset.asset_tag}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(alloc)
    return await _hydrate(db, alloc)


async def _raise_active_conflict(db: AsyncSession, asset: Asset):
    active = (
        await db.execute(
            select(AssetAllocation).where(
                AssetAllocation.asset_id == asset.asset_id,
                AssetAllocation.status == "ACTIVE",
            )
        )
    ).scalar_one_or_none()
    holder = None
    if active is not None:
        holder = {
            "allocation_id": str(active.allocation_id),
            "employee_id": str(active.employee_id) if active.employee_id else None,
            "employee_name": await _employee_name(db, active.employee_id),
            "department_id": str(active.department_id) if active.department_id else None,
            "department_name": await _department_name(db, active.department_id),
        }
    who = holder["employee_name"] if holder and holder.get("employee_name") else "another party"
    dept = f" ({holder['department_name']})" if holder and holder.get("department_name") else ""
    raise HTTPException(
        status_code=409,
        detail={
            "message": f"Asset {asset.asset_tag} is currently allocated to {who}{dept}. "
            "Use a transfer request instead.",
            "current_holder": holder,
            "suggest_transfer": True,
        },
    )


async def return_asset(
    db: AsyncSession, allocation_id: uuid.UUID, data, actor: Employee, ip: str | None
) -> AllocationResponse:
    alloc = (
        await db.execute(
            select(AssetAllocation).where(
                AssetAllocation.allocation_id == allocation_id
            )
        )
    ).scalar_one_or_none()
    if alloc is None:
        raise HTTPException(status_code=404, detail="Allocation not found.")
    if alloc.status != "ACTIVE":
        raise HTTPException(
            status_code=409, detail="Allocation is not active; nothing to return."
        )

    alloc.actual_return_date = date.today()
    alloc.return_condition = data.return_condition
    alloc.return_notes = data.return_notes
    alloc.status = "RETURNED"
    alloc.updated_on = datetime.now(timezone.utc)
    # Flush so the status-sync trigger reverts the asset to AVAILABLE.
    await db.flush()

    db.add(
        AllocationHistory(
            allocation_id=alloc.allocation_id,
            action="RETURNED",
            performed_by=actor.employee_id,
            details={"return_condition": data.return_condition},
        )
    )

    asset = await _asset_or_404(db, alloc.asset_id)
    if data.return_condition == "DAMAGED":
        for mgr_id in await _asset_manager_ids(db):
            await create_notification(
                db, mgr_id, "ASSET_DAMAGED",
                "Asset returned damaged",
                f"Asset {asset.asset_tag} ({asset.name}) was returned in DAMAGED "
                "condition. A maintenance request may be needed.",
                "asset_allocations", alloc.allocation_id,
            )

    await log_activity(
        db, actor.user_id, "RETURN_ASSET", "asset_allocations", alloc.allocation_id,
        new_value={"return_condition": data.return_condition}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(alloc)
    return await _hydrate(db, alloc)


async def list_allocations(
    db: AsyncSession,
    *,
    asset_id: uuid.UUID | None = None,
    employee_id: uuid.UUID | None = None,
    department_id: uuid.UUID | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AllocationResponse], int]:
    filters = []
    if asset_id:
        filters.append(AssetAllocation.asset_id == asset_id)
    if employee_id:
        filters.append(AssetAllocation.employee_id == employee_id)
    if department_id:
        filters.append(AssetAllocation.department_id == department_id)
    if status:
        filters.append(AssetAllocation.status == status)
    total = (
        await db.execute(
            select(func.count()).select_from(AssetAllocation).where(*filters)
        )
    ).scalar_one()
    stmt = (
        select(AssetAllocation)
        .where(*filters)
        .order_by(AssetAllocation.created_on.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [await _hydrate(db, a) for a in rows], total


async def get_allocation(
    db: AsyncSession, allocation_id: uuid.UUID
) -> AllocationResponse:
    alloc = (
        await db.execute(
            select(AssetAllocation).where(
                AssetAllocation.allocation_id == allocation_id
            )
        )
    ).scalar_one_or_none()
    if alloc is None:
        raise HTTPException(status_code=404, detail="Allocation not found.")
    return await _hydrate(db, alloc)


async def list_overdue(db: AsyncSession) -> list[dict]:
    rows = (
        await db.execute(
            text(
                "SELECT allocation_id, asset_id, asset_tag, asset_name, employee_id, "
                "department_id, expected_return_date, days_overdue "
                "FROM v_overdue_allocations ORDER BY days_overdue DESC"
            )
        )
    ).mappings().all()
    return [dict(r) for r in rows]
