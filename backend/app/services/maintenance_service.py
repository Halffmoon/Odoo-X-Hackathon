import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset, AssetAttachment
from app.models.employee import Employee, Role
from app.models.maintenance import MaintenanceHistory, MaintenanceRequest
from app.schemas.maintenance import MaintenanceResponse
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


async def _get_or_404(
    db: AsyncSession, maintenance_id: uuid.UUID
) -> MaintenanceRequest:
    m = (
        await db.execute(
            select(MaintenanceRequest).where(
                MaintenanceRequest.maintenance_id == maintenance_id
            )
        )
    ).scalar_one_or_none()
    if m is None:
        raise HTTPException(status_code=404, detail="Maintenance request not found.")
    return m


async def _name(db: AsyncSession, employee_id: uuid.UUID | None) -> str | None:
    if employee_id is None:
        return None
    return (
        await db.execute(
            select(Employee.name).where(Employee.employee_id == employee_id)
        )
    ).scalar_one_or_none()


async def _hydrate(db: AsyncSession, m: MaintenanceRequest) -> MaintenanceResponse:
    asset = (
        await db.execute(select(Asset).where(Asset.asset_id == m.asset_id))
    ).scalar_one_or_none()
    return MaintenanceResponse(
        maintenance_id=m.maintenance_id,
        asset_id=m.asset_id,
        asset_tag=asset.asset_tag if asset else None,
        asset_name=asset.name if asset else None,
        requested_by=m.requested_by,
        requester_name=await _name(db, m.requested_by),
        issue_description=m.issue_description,
        priority=m.priority,
        status=m.status,
        approved_by=m.approved_by,
        approved_on=m.approved_on,
        technician_id=m.technician_id,
        technician_name=await _name(db, m.technician_id),
        resolved_on=m.resolved_on,
        resolution_notes=m.resolution_notes,
        created_on=m.created_on,
        updated_on=m.updated_on,
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


async def raise_request(
    db: AsyncSession, data, actor: Employee, ip: str | None
) -> MaintenanceResponse:
    asset = await _asset_or_404(db, data.asset_id)
    asset_tag = asset.asset_tag
    m = MaintenanceRequest(
        asset_id=data.asset_id,
        requested_by=actor.employee_id,
        issue_description=data.issue_description,
        priority=data.priority,
    )
    db.add(m)
    await db.flush()
    db.add(
        MaintenanceHistory(
            maintenance_id=m.maintenance_id,
            action="RAISED",
            performed_by=actor.employee_id,
        )
    )
    for mgr_id in await _asset_manager_ids(db):
        await create_notification(
            db, mgr_id, "MAINTENANCE_REQUEST",
            "New maintenance request",
            f"{actor.name} raised a {data.priority} maintenance request for {asset_tag}.",
            "maintenance_requests", m.maintenance_id,
        )
    await log_activity(
        db, actor.user_id, "RAISE_MAINTENANCE", "maintenance_requests", m.maintenance_id,
        new_value={"asset_tag": asset_tag, "priority": data.priority}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(m)
    return await _hydrate(db, m)


async def _transition(
    db: AsyncSession,
    m: MaintenanceRequest,
    new_status: str,
    action: str,
    actor: Employee,
):
    m.status = new_status
    m.updated_on = datetime.now(timezone.utc)
    # Flush so fn_sync_asset_status_on_maintenance updates the asset.
    await db.flush()
    db.add(
        MaintenanceHistory(
            maintenance_id=m.maintenance_id,
            action=action,
            performed_by=actor.employee_id,
        )
    )


async def approve(
    db: AsyncSession, maintenance_id: uuid.UUID, actor: Employee, ip: str | None
) -> MaintenanceResponse:
    m = await _get_or_404(db, maintenance_id)
    if m.status != "PENDING":
        raise HTTPException(
            status_code=409, detail=f"Request is {m.status}; only PENDING can be approved."
        )
    m.approved_by = actor.employee_id
    m.approved_on = datetime.now(timezone.utc)
    await _transition(db, m, "APPROVED", "APPROVED", actor)
    await create_notification(
        db, m.requested_by, "MAINTENANCE_APPROVED",
        "Maintenance approved",
        "Your maintenance request has been approved.",
        "maintenance_requests", m.maintenance_id,
    )
    await log_activity(
        db, actor.user_id, "APPROVE_MAINTENANCE", "maintenance_requests",
        m.maintenance_id, ip_address=ip,
    )
    await db.commit()
    await db.refresh(m)
    return await _hydrate(db, m)


async def reject(
    db: AsyncSession, maintenance_id: uuid.UUID, reason: str | None,
    actor: Employee, ip: str | None,
) -> MaintenanceResponse:
    m = await _get_or_404(db, maintenance_id)
    if m.status != "PENDING":
        raise HTTPException(
            status_code=409, detail=f"Request is {m.status}; only PENDING can be rejected."
        )
    m.approved_by = actor.employee_id
    m.approved_on = datetime.now(timezone.utc)
    await _transition(db, m, "REJECTED", "REJECTED", actor)
    await create_notification(
        db, m.requested_by, "MAINTENANCE_REJECTED",
        "Maintenance rejected",
        "Your maintenance request was rejected." + (f" Reason: {reason}" if reason else ""),
        "maintenance_requests", m.maintenance_id,
    )
    await log_activity(
        db, actor.user_id, "REJECT_MAINTENANCE", "maintenance_requests",
        m.maintenance_id, ip_address=ip,
    )
    await db.commit()
    await db.refresh(m)
    return await _hydrate(db, m)


async def assign_technician(
    db: AsyncSession, maintenance_id: uuid.UUID, technician_id: uuid.UUID,
    actor: Employee, ip: str | None,
) -> MaintenanceResponse:
    m = await _get_or_404(db, maintenance_id)
    if m.status != "APPROVED":
        raise HTTPException(
            status_code=409,
            detail=f"Request is {m.status}; a technician can only be assigned when APPROVED.",
        )
    tech = (
        await db.execute(
            select(Employee).where(
                Employee.employee_id == technician_id,
                Employee.is_deleted.is_(False),
            )
        )
    ).scalar_one_or_none()
    if tech is None:
        raise HTTPException(status_code=404, detail="Technician (employee) not found.")

    m.technician_id = technician_id
    await _transition(db, m, "TECHNICIAN_ASSIGNED", "TECHNICIAN_ASSIGNED", actor)
    await create_notification(
        db, technician_id, "MAINTENANCE_ASSIGNED",
        "Maintenance assigned to you",
        "You have been assigned a maintenance task.",
        "maintenance_requests", m.maintenance_id,
    )
    await log_activity(
        db, actor.user_id, "ASSIGN_TECHNICIAN", "maintenance_requests",
        m.maintenance_id, ip_address=ip,
    )
    await db.commit()
    await db.refresh(m)
    return await _hydrate(db, m)


async def start(
    db: AsyncSession, maintenance_id: uuid.UUID, actor: Employee, ip: str | None
) -> MaintenanceResponse:
    m = await _get_or_404(db, maintenance_id)
    if m.status != "TECHNICIAN_ASSIGNED":
        raise HTTPException(
            status_code=409,
            detail=f"Request is {m.status}; work can only start when TECHNICIAN_ASSIGNED.",
        )
    if m.technician_id != actor.employee_id and actor.role.role_code not in ("ADMIN", "ASSET_MANAGER"):
        raise HTTPException(
            status_code=403, detail="Only the assigned technician can start this task."
        )
    await _transition(db, m, "IN_PROGRESS", "STARTED", actor)
    await log_activity(
        db, actor.user_id, "START_MAINTENANCE", "maintenance_requests",
        m.maintenance_id, ip_address=ip,
    )
    await db.commit()
    await db.refresh(m)
    return await _hydrate(db, m)


async def resolve(
    db: AsyncSession, maintenance_id: uuid.UUID, resolution_notes: str | None,
    actor: Employee, ip: str | None,
) -> MaintenanceResponse:
    m = await _get_or_404(db, maintenance_id)
    if m.status != "IN_PROGRESS":
        raise HTTPException(
            status_code=409,
            detail=f"Request is {m.status}; only IN_PROGRESS can be resolved.",
        )
    if m.technician_id != actor.employee_id and actor.role.role_code not in ("ADMIN", "ASSET_MANAGER"):
        raise HTTPException(
            status_code=403, detail="Only the assigned technician can resolve this task."
        )
    m.resolved_on = datetime.now(timezone.utc)
    m.resolution_notes = resolution_notes
    await _transition(db, m, "RESOLVED", "RESOLVED", actor)

    recipients = {m.requested_by, *await _asset_manager_ids(db)}
    for rid in recipients:
        await create_notification(
            db, rid, "MAINTENANCE_RESOLVED",
            "Maintenance resolved",
            "A maintenance request has been resolved and the asset is available.",
            "maintenance_requests", m.maintenance_id,
        )
    await log_activity(
        db, actor.user_id, "RESOLVE_MAINTENANCE", "maintenance_requests",
        m.maintenance_id, ip_address=ip,
    )
    await db.commit()
    await db.refresh(m)
    return await _hydrate(db, m)


async def add_attachment(
    db: AsyncSession, maintenance_id: uuid.UUID, file_url: str, file_type: str,
    actor: Employee, ip: str | None,
) -> AssetAttachment:
    await _get_or_404(db, maintenance_id)
    attachment = AssetAttachment(
        asset_id=None,
        maintenance_id=maintenance_id,
        file_url=file_url,
        file_type=file_type,
        uploaded_by=actor.employee_id,
    )
    db.add(attachment)
    await log_activity(
        db, actor.user_id, "ADD_MAINT_ATTACHMENT", "asset_attachments", None,
        new_value={"maintenance_id": str(maintenance_id), "file_url": file_url},
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(attachment)
    return attachment


async def list_attachments(
    db: AsyncSession, maintenance_id: uuid.UUID
) -> list[AssetAttachment]:
    await _get_or_404(db, maintenance_id)
    return list(
        (
            await db.execute(
                select(AssetAttachment)
                .where(AssetAttachment.maintenance_id == maintenance_id)
                .order_by(AssetAttachment.uploaded_on.desc())
            )
        ).scalars().all()
    )


async def list_requests(
    db: AsyncSession,
    *,
    asset_id: uuid.UUID | None = None,
    status: str | None = None,
    priority: str | None = None,
    technician_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[MaintenanceResponse], int]:
    filters = []
    if asset_id:
        filters.append(MaintenanceRequest.asset_id == asset_id)
    if status:
        filters.append(MaintenanceRequest.status == status)
    if priority:
        filters.append(MaintenanceRequest.priority == priority)
    if technician_id:
        filters.append(MaintenanceRequest.technician_id == technician_id)
    total = (
        await db.execute(
            select(func.count()).select_from(MaintenanceRequest).where(*filters)
        )
    ).scalar_one()
    stmt = (
        select(MaintenanceRequest)
        .where(*filters)
        .order_by(MaintenanceRequest.created_on.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [await _hydrate(db, m) for m in rows], total


async def get_request(
    db: AsyncSession, maintenance_id: uuid.UUID
) -> MaintenanceResponse:
    return await _hydrate(db, await _get_or_404(db, maintenance_id))


async def get_history(
    db: AsyncSession, maintenance_id: uuid.UUID
) -> list[MaintenanceHistory]:
    await _get_or_404(db, maintenance_id)
    return list(
        (
            await db.execute(
                select(MaintenanceHistory)
                .where(MaintenanceHistory.maintenance_id == maintenance_id)
                .order_by(MaintenanceHistory.performed_on.desc())
            )
        ).scalars().all()
    )
