import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.audit import (
    AuditAssignment,
    AuditCycle,
    AuditDiscrepancy,
    AuditResult,
)
from app.models.employee import Employee
from app.schemas.audit import (
    AuditCycleResponse,
    AuditProgress,
    DiscrepancyResponse,
)
from app.utils.activity_logger import log_activity
from app.utils.notification_helper import create_notification


async def _cycle_or_404(db: AsyncSession, cycle_id: uuid.UUID) -> AuditCycle:
    c = (
        await db.execute(
            select(AuditCycle).where(AuditCycle.audit_cycle_id == cycle_id)
        )
    ).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=404, detail="Audit cycle not found.")
    return c


def _scope_filter(cycle: AuditCycle):
    if cycle.department_id is not None:
        return Asset.current_department_id == cycle.department_id
    return Asset.location_id == cycle.location_id


async def _auditor_ids(db: AsyncSession, cycle_id: uuid.UUID) -> list[uuid.UUID]:
    return list(
        (
            await db.execute(
                select(AuditAssignment.auditor_employee_id).where(
                    AuditAssignment.audit_cycle_id == cycle_id
                )
            )
        ).scalars().all()
    )


async def _progress(db: AsyncSession, cycle: AuditCycle) -> AuditProgress:
    total = (
        await db.execute(
            select(func.count())
            .select_from(Asset)
            .where(Asset.is_deleted.is_(False), _scope_filter(cycle))
        )
    ).scalar_one()
    counts = dict(
        (
            await db.execute(
                select(AuditResult.finding, func.count())
                .where(AuditResult.audit_cycle_id == cycle.audit_cycle_id)
                .group_by(AuditResult.finding)
            )
        ).all()
    )
    verified = counts.get("VERIFIED", 0)
    missing = counts.get("MISSING", 0)
    damaged = counts.get("DAMAGED", 0)
    return AuditProgress(
        total_in_scope=total,
        verified=verified,
        missing=missing,
        damaged=damaged,
        recorded=verified + missing + damaged,
    )


async def _hydrate(db: AsyncSession, cycle: AuditCycle) -> AuditCycleResponse:
    return AuditCycleResponse(
        audit_cycle_id=cycle.audit_cycle_id,
        name=cycle.name,
        department_id=cycle.department_id,
        location_id=cycle.location_id,
        start_date=cycle.start_date,
        end_date=cycle.end_date,
        status=cycle.status,
        closed_by=cycle.closed_by,
        closed_on=cycle.closed_on,
        created_on=cycle.created_on,
        progress=await _progress(db, cycle),
        auditor_employee_ids=await _auditor_ids(db, cycle.audit_cycle_id),
    )


async def create_cycle(
    db: AsyncSession, data, actor: Employee, ip: str | None
) -> AuditCycleResponse:
    cycle = AuditCycle(
        name=data.name,
        department_id=data.department_id,
        location_id=data.location_id,
        start_date=data.start_date,
        end_date=data.end_date,
        status="PLANNED",
        created_by=actor.user_id,
    )
    db.add(cycle)
    await db.flush()

    for aud_id in set(data.auditor_employee_ids):
        db.add(
            AuditAssignment(
                audit_cycle_id=cycle.audit_cycle_id, auditor_employee_id=aud_id
            )
        )
        await create_notification(
            db, aud_id, "AUDIT_ASSIGNED",
            "You have been assigned to an audit",
            f"You are an auditor for cycle '{cycle.name}'.",
            "audit_cycles", cycle.audit_cycle_id,
        )
    await log_activity(
        db, actor.user_id, "CREATE_AUDIT_CYCLE", "audit_cycles", cycle.audit_cycle_id,
        new_value={"name": cycle.name}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(cycle)
    return await _hydrate(db, cycle)


async def record_finding(
    db: AsyncSession, cycle_id: uuid.UUID, data, actor: Employee, ip: str | None
):
    cycle = await _cycle_or_404(db, cycle_id)
    if cycle.status == "CLOSED":
        raise HTTPException(status_code=409, detail="Audit cycle is closed.")
    if actor.employee_id not in await _auditor_ids(db, cycle_id):
        raise HTTPException(
            status_code=403, detail="You are not an assigned auditor for this cycle."
        )
    # Verify the asset is in scope.
    in_scope = (
        await db.execute(
            select(Asset.asset_id).where(
                Asset.asset_id == data.asset_id,
                Asset.is_deleted.is_(False),
                _scope_filter(cycle),
            )
        )
    ).scalar_one_or_none()
    if in_scope is None:
        raise HTTPException(
            status_code=422, detail="Asset is not in this audit cycle's scope."
        )

    if cycle.status == "PLANNED":
        cycle.status = "IN_PROGRESS"

    result = AuditResult(
        audit_cycle_id=cycle_id,
        asset_id=data.asset_id,
        auditor_employee_id=actor.employee_id,
        finding=data.finding,
        remarks=data.remarks,
    )
    db.add(result)
    try:
        # Flush fires fn_autogen_audit_discrepancy for MISSING/DAMAGED findings.
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="A finding for this asset already exists in the cycle."
        )
    await log_activity(
        db, actor.user_id, "RECORD_AUDIT_FINDING", "audit_results",
        result.audit_result_id, new_value={"finding": data.finding}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(result)
    return result


async def close_cycle(
    db: AsyncSession, cycle_id: uuid.UUID, actor: Employee, ip: str | None
) -> AuditCycleResponse:
    cycle = await _cycle_or_404(db, cycle_id)
    if cycle.status == "CLOSED":
        raise HTTPException(status_code=409, detail="Audit cycle is already closed.")

    cycle.status = "CLOSED"
    cycle.closed_by = actor.employee_id
    cycle.closed_on = datetime.now(timezone.utc)
    # Flush fires fn_close_audit_cycle which marks MISSING assets as LOST.
    await db.flush()

    progress = await _progress(db, cycle)
    for aud_id in {*await _auditor_ids(db, cycle_id)}:
        await create_notification(
            db, aud_id, "AUDIT_CLOSED",
            "Audit cycle closed",
            f"Cycle '{cycle.name}' closed. Verified {progress.verified}, "
            f"missing {progress.missing}, damaged {progress.damaged}.",
            "audit_cycles", cycle.audit_cycle_id,
        )
    await log_activity(
        db, actor.user_id, "CLOSE_AUDIT_CYCLE", "audit_cycles", cycle.audit_cycle_id,
        new_value={"missing": progress.missing, "damaged": progress.damaged},
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(cycle)
    return await _hydrate(db, cycle)


async def add_auditor(
    db: AsyncSession, cycle_id: uuid.UUID, auditor_id: uuid.UUID,
    actor: Employee, ip: str | None,
) -> AuditAssignment:
    cycle = await _cycle_or_404(db, cycle_id)
    emp = (
        await db.execute(
            select(Employee).where(
                Employee.employee_id == auditor_id, Employee.is_deleted.is_(False)
            )
        )
    ).scalar_one_or_none()
    if emp is None:
        raise HTTPException(status_code=404, detail="Auditor (employee) not found.")
    assignment = AuditAssignment(
        audit_cycle_id=cycle_id, auditor_employee_id=auditor_id
    )
    db.add(assignment)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="This auditor is already assigned to the cycle."
        )
    await create_notification(
        db, auditor_id, "AUDIT_ASSIGNED",
        "You have been assigned to an audit",
        f"You are an auditor for cycle '{cycle.name}'.",
        "audit_cycles", cycle_id,
    )
    await log_activity(
        db, actor.user_id, "ADD_AUDITOR", "audit_assignments",
        assignment.audit_assignment_id, ip_address=ip,
    )
    await db.commit()
    await db.refresh(assignment)
    return assignment


async def remove_auditor(
    db: AsyncSession, cycle_id: uuid.UUID, auditor_id: uuid.UUID,
    actor: Employee, ip: str | None,
) -> None:
    await _cycle_or_404(db, cycle_id)
    assignment = (
        await db.execute(
            select(AuditAssignment).where(
                AuditAssignment.audit_cycle_id == cycle_id,
                AuditAssignment.auditor_employee_id == auditor_id,
            )
        )
    ).scalar_one_or_none()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Auditor not assigned to this cycle.")
    await db.delete(assignment)
    await log_activity(
        db, actor.user_id, "REMOVE_AUDITOR", "audit_assignments",
        assignment.audit_assignment_id, ip_address=ip,
    )
    await db.commit()


async def list_auditors(
    db: AsyncSession, cycle_id: uuid.UUID
) -> list[AuditAssignment]:
    await _cycle_or_404(db, cycle_id)
    return list(
        (
            await db.execute(
                select(AuditAssignment).where(
                    AuditAssignment.audit_cycle_id == cycle_id
                )
            )
        ).scalars().all()
    )


async def list_results(
    db: AsyncSession, cycle_id: uuid.UUID
) -> list[AuditResult]:
    await _cycle_or_404(db, cycle_id)
    return list(
        (
            await db.execute(
                select(AuditResult)
                .where(AuditResult.audit_cycle_id == cycle_id)
                .order_by(AuditResult.recorded_on.desc())
            )
        ).scalars().all()
    )


async def list_cycles(
    db: AsyncSession, status: str | None = None
) -> list[AuditCycleResponse]:
    stmt = select(AuditCycle)
    if status:
        stmt = stmt.where(AuditCycle.status == status)
    stmt = stmt.order_by(AuditCycle.created_on.desc())
    cycles = (await db.execute(stmt)).scalars().all()
    return [await _hydrate(db, c) for c in cycles]


async def get_cycle(
    db: AsyncSession, cycle_id: uuid.UUID
) -> AuditCycleResponse:
    return await _hydrate(db, await _cycle_or_404(db, cycle_id))


# ---------------- Discrepancies ----------------

async def _discrepancy_row(db: AsyncSession, disc: AuditDiscrepancy) -> DiscrepancyResponse:
    result = (
        await db.execute(
            select(AuditResult).where(
                AuditResult.audit_result_id == disc.audit_result_id
            )
        )
    ).scalar_one()
    asset_tag = (
        await db.execute(
            select(Asset.asset_tag).where(Asset.asset_id == result.asset_id)
        )
    ).scalar_one_or_none()
    return DiscrepancyResponse(
        discrepancy_id=disc.discrepancy_id,
        audit_result_id=disc.audit_result_id,
        audit_cycle_id=result.audit_cycle_id,
        asset_id=result.asset_id,
        asset_tag=asset_tag,
        finding=result.finding,
        status=disc.status,
        resolved_by=disc.resolved_by,
        resolved_on=disc.resolved_on,
        resolution_notes=disc.resolution_notes,
    )


async def list_discrepancies(
    db: AsyncSession, status: str | None = None
) -> list[DiscrepancyResponse]:
    stmt = select(AuditDiscrepancy)
    if status:
        stmt = stmt.where(AuditDiscrepancy.status == status)
    rows = (await db.execute(stmt)).scalars().all()
    return [await _discrepancy_row(db, d) for d in rows]


async def get_discrepancy(
    db: AsyncSession, discrepancy_id: uuid.UUID
) -> DiscrepancyResponse:
    disc = (
        await db.execute(
            select(AuditDiscrepancy).where(
                AuditDiscrepancy.discrepancy_id == discrepancy_id
            )
        )
    ).scalar_one_or_none()
    if disc is None:
        raise HTTPException(status_code=404, detail="Discrepancy not found.")
    return await _discrepancy_row(db, disc)


async def resolve_discrepancy(
    db: AsyncSession, discrepancy_id: uuid.UUID, notes: str | None,
    actor: Employee, ip: str | None,
) -> DiscrepancyResponse:
    disc = (
        await db.execute(
            select(AuditDiscrepancy).where(
                AuditDiscrepancy.discrepancy_id == discrepancy_id
            )
        )
    ).scalar_one_or_none()
    if disc is None:
        raise HTTPException(status_code=404, detail="Discrepancy not found.")
    if disc.status == "RESOLVED":
        raise HTTPException(status_code=409, detail="Discrepancy already resolved.")
    disc.status = "RESOLVED"
    disc.resolved_by = actor.employee_id
    disc.resolved_on = datetime.now(timezone.utc)
    disc.resolution_notes = notes
    await log_activity(
        db, actor.user_id, "RESOLVE_DISCREPANCY", "audit_discrepancies",
        disc.discrepancy_id, ip_address=ip,
    )
    await db.commit()
    await db.refresh(disc)
    return await _discrepancy_row(db, disc)
