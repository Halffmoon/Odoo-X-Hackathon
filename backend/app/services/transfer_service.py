import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.allocation import AllocationHistory, AssetAllocation
from app.models.asset import Asset
from app.models.department import Department
from app.models.employee import Employee, Role
from app.models.transfer import AssetTransfer
from app.schemas.transfer import TransferResponse
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


async def _active_allocation(
    db: AsyncSession, asset_id: uuid.UUID
) -> AssetAllocation | None:
    return (
        await db.execute(
            select(AssetAllocation).where(
                AssetAllocation.asset_id == asset_id,
                AssetAllocation.status == "ACTIVE",
            )
        )
    ).scalar_one_or_none()


async def _employee(db: AsyncSession, employee_id: uuid.UUID | None) -> Employee | None:
    if employee_id is None:
        return None
    return (
        await db.execute(
            select(Employee).where(Employee.employee_id == employee_id)
        )
    ).scalar_one_or_none()


async def _hydrate(db: AsyncSession, tr: AssetTransfer) -> TransferResponse:
    asset = (
        await db.execute(select(Asset).where(Asset.asset_id == tr.asset_id))
    ).scalar_one_or_none()
    from_emp = await _employee(db, tr.from_employee_id)
    to_emp = await _employee(db, tr.to_employee_id)
    return TransferResponse(
        transfer_id=tr.transfer_id,
        asset_id=tr.asset_id,
        asset_tag=asset.asset_tag if asset else None,
        from_employee_id=tr.from_employee_id,
        from_employee_name=from_emp.name if from_emp else None,
        to_employee_id=tr.to_employee_id,
        to_employee_name=to_emp.name if to_emp else None,
        requested_by=tr.requested_by,
        approved_by=tr.approved_by,
        status=tr.status,
        requested_on=tr.requested_on,
        approved_on=tr.approved_on,
        completed_on=tr.completed_on,
        remarks=tr.remarks,
    )


async def _asset_manager_ids(db: AsyncSession) -> list[uuid.UUID]:
    return list(
        (
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
    )


async def initiate(
    db: AsyncSession, data, actor: Employee, ip: str | None
) -> TransferResponse:
    asset = await _asset_or_404(db, data.asset_id)
    active = await _active_allocation(db, asset.asset_id)
    if active is None:
        raise HTTPException(
            status_code=409,
            detail=f"Asset {asset.asset_tag} has no active allocation to transfer.",
        )

    to_emp = await _employee(db, data.to_employee_id)
    if to_emp is None or to_emp.is_deleted:
        raise HTTPException(status_code=404, detail="Target employee not found.")

    if active.employee_id is not None and active.employee_id == data.to_employee_id:
        raise HTTPException(
            status_code=409, detail="Asset already belongs to that employee."
        )

    tr = AssetTransfer(
        asset_id=asset.asset_id,
        from_employee_id=active.employee_id,
        to_employee_id=data.to_employee_id,
        requested_by=actor.employee_id,
        status="REQUESTED",
        remarks=data.remarks,
    )
    db.add(tr)
    await db.flush()

    # Notify asset managers + the current dept head (via department, if any).
    recipients = set(await _asset_manager_ids(db))
    if asset.current_department_id:
        head_id = (
            await db.execute(
                select(Department.head_employee_id).where(
                    Department.department_id == asset.current_department_id
                )
            )
        ).scalar_one_or_none()
        if head_id:
            recipients.add(head_id)
    for mgr_id in recipients:
        await create_notification(
            db, mgr_id, "TRANSFER_REQUEST",
            "Asset transfer requested",
            f"A transfer of {asset.asset_tag} to {to_emp.name} is awaiting approval.",
            "asset_transfers", tr.transfer_id,
        )

    await log_activity(
        db, actor.user_id, "INITIATE_TRANSFER", "asset_transfers", tr.transfer_id,
        new_value={"asset_tag": asset.asset_tag, "to": str(data.to_employee_id)},
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(tr)
    return await _hydrate(db, tr)


async def _get_transfer_or_404(
    db: AsyncSession, transfer_id: uuid.UUID
) -> AssetTransfer:
    tr = (
        await db.execute(
            select(AssetTransfer).where(AssetTransfer.transfer_id == transfer_id)
        )
    ).scalar_one_or_none()
    if tr is None:
        raise HTTPException(status_code=404, detail="Transfer not found.")
    return tr


async def approve(
    db: AsyncSession, transfer_id: uuid.UUID, data, actor: Employee, ip: str | None
) -> TransferResponse:
    tr = await _get_transfer_or_404(db, transfer_id)
    if tr.status != "REQUESTED":
        raise HTTPException(
            status_code=409, detail=f"Transfer is {tr.status}, cannot approve."
        )

    now = datetime.now(timezone.utc)
    tr.status = "APPROVED"
    tr.approved_by = actor.employee_id
    tr.approved_on = now
    if data.remarks:
        tr.remarks = data.remarks

    # Execute: return the current active allocation, then re-allocate.
    active = await _active_allocation(db, tr.asset_id)
    if active is None:
        raise HTTPException(
            status_code=409,
            detail="Asset no longer has an active allocation; cannot complete transfer.",
        )

    active.status = "RETURNED"
    active.actual_return_date = date.today()
    active.return_notes = f"Transferred (transfer {tr.transfer_id})"
    active.updated_on = now
    # Flush first: trigger reverts asset to AVAILABLE and frees the unique index.
    await db.flush()
    db.add(
        AllocationHistory(
            allocation_id=active.allocation_id,
            action="TRANSFERRED",
            performed_by=actor.employee_id,
            details={"transfer_id": str(tr.transfer_id)},
        )
    )

    new_alloc = AssetAllocation(
        asset_id=tr.asset_id,
        employee_id=tr.to_employee_id,
        status="ACTIVE",
        allocated_by=actor.employee_id,
    )
    db.add(new_alloc)
    await db.flush()  # trigger sets asset back to ALLOCATED
    db.add(
        AllocationHistory(
            allocation_id=new_alloc.allocation_id,
            action="ALLOCATED",
            performed_by=actor.employee_id,
            details={"transfer_id": str(tr.transfer_id)},
        )
    )

    tr.status = "COMPLETED"
    tr.completed_on = now

    asset = await _asset_or_404(db, tr.asset_id)
    if tr.from_employee_id:
        await create_notification(
            db, tr.from_employee_id, "TRANSFER_COMPLETED",
            "Asset transferred away",
            f"Asset {asset.asset_tag} has been transferred from you.",
            "asset_transfers", tr.transfer_id,
        )
    await create_notification(
        db, tr.to_employee_id, "TRANSFER_COMPLETED",
        "Asset transferred to you",
        f"Asset {asset.asset_tag} ({asset.name}) is now allocated to you.",
        "asset_transfers", tr.transfer_id,
    )

    await log_activity(
        db, actor.user_id, "APPROVE_TRANSFER", "asset_transfers", tr.transfer_id,
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(tr)
    return await _hydrate(db, tr)


async def reject(
    db: AsyncSession, transfer_id: uuid.UUID, data, actor: Employee, ip: str | None
) -> TransferResponse:
    tr = await _get_transfer_or_404(db, transfer_id)
    if tr.status != "REQUESTED":
        raise HTTPException(
            status_code=409, detail=f"Transfer is {tr.status}, cannot reject."
        )
    tr.status = "REJECTED"
    tr.approved_by = actor.employee_id
    tr.approved_on = datetime.now(timezone.utc)
    if data.remarks:
        tr.remarks = data.remarks

    await create_notification(
        db, tr.requested_by, "TRANSFER_REJECTED",
        "Transfer request rejected",
        f"Your transfer request for the asset was rejected."
        + (f" Reason: {data.remarks}" if data.remarks else ""),
        "asset_transfers", tr.transfer_id,
    )
    await log_activity(
        db, actor.user_id, "REJECT_TRANSFER", "asset_transfers", tr.transfer_id,
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(tr)
    return await _hydrate(db, tr)


async def list_transfers(
    db: AsyncSession,
    *,
    asset_id: uuid.UUID | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[TransferResponse], int]:
    filters = []
    if asset_id:
        filters.append(AssetTransfer.asset_id == asset_id)
    if status:
        filters.append(AssetTransfer.status == status)
    total = (
        await db.execute(
            select(func.count()).select_from(AssetTransfer).where(*filters)
        )
    ).scalar_one()
    stmt = (
        select(AssetTransfer)
        .where(*filters)
        .order_by(AssetTransfer.requested_on.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [await _hydrate(db, t) for t in rows], total


async def get_transfer(
    db: AsyncSession, transfer_id: uuid.UUID
) -> TransferResponse:
    tr = await _get_transfer_or_404(db, transfer_id)
    return await _hydrate(db, tr)
