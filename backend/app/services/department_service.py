import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.department import Department
from app.models.employee import Employee
from app.schemas.department import (
    DepartmentCreate,
    DepartmentTreeNode,
    DepartmentUpdate,
)
from app.utils.activity_logger import log_activity


async def _get_or_404(db: AsyncSession, department_id: uuid.UUID) -> Department:
    result = await db.execute(
        select(Department).where(
            Department.department_id == department_id,
            Department.is_deleted.is_(False),
        )
    )
    dept = result.scalar_one_or_none()
    if dept is None:
        raise HTTPException(status_code=404, detail="Department not found.")
    return dept


async def list_departments(
    db: AsyncSession, include_inactive: bool = False
) -> list[Department]:
    stmt = select(Department).where(Department.is_deleted.is_(False))
    if not include_inactive:
        stmt = stmt.where(Department.status == "ACTIVE")
    stmt = stmt.order_by(Department.name)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_department(db: AsyncSession, department_id: uuid.UUID) -> Department:
    return await _get_or_404(db, department_id)


async def create_department(
    db: AsyncSession, data: DepartmentCreate, actor: Employee, ip: str | None
) -> Department:
    dept = Department(
        name=data.name,
        parent_department_id=data.parent_department_id,
        head_employee_id=data.head_employee_id,
        created_by=actor.user_id,
        updated_by=actor.user_id,
    )
    db.add(dept)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A department with this name already exists under the same parent.",
        )
    await log_activity(
        db, actor.user_id, "CREATE_DEPARTMENT", "departments", dept.department_id,
        new_value={"name": dept.name}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(dept)
    return dept


async def update_department(
    db: AsyncSession,
    department_id: uuid.UUID,
    data: DepartmentUpdate,
    actor: Employee,
    ip: str | None,
) -> Department:
    dept = await _get_or_404(db, department_id)
    old = {"name": dept.name, "status": dept.status}

    if data.parent_department_id == department_id:
        raise HTTPException(
            status_code=400, detail="A department cannot be its own parent."
        )

    for field in ("name", "parent_department_id", "head_employee_id", "status"):
        value = getattr(data, field)
        if value is not None:
            setattr(dept, field, value)
    dept.updated_by = actor.user_id
    dept.updated_on = datetime.now(timezone.utc)

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A department with this name already exists under the same parent.",
        )
    await log_activity(
        db, actor.user_id, "UPDATE_DEPARTMENT", "departments", dept.department_id,
        old_value=old, new_value={"name": dept.name, "status": dept.status},
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(dept)
    return dept


async def deactivate_department(
    db: AsyncSession, department_id: uuid.UUID, actor: Employee, ip: str | None
) -> None:
    dept = await _get_or_404(db, department_id)

    active_count = (
        await db.execute(
            select(func.count())
            .select_from(Employee)
            .where(
                Employee.department_id == department_id,
                Employee.is_deleted.is_(False),
                Employee.status == "ACTIVE",
            )
        )
    ).scalar_one()
    if active_count > 0:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot deactivate: {active_count} active employee(s) still belong "
                "to this department. Reassign them first."
            ),
        )

    dept.status = "INACTIVE"
    dept.is_deleted = True
    dept.updated_by = actor.user_id
    dept.updated_on = datetime.now(timezone.utc)
    await log_activity(
        db, actor.user_id, "DEACTIVATE_DEPARTMENT", "departments", dept.department_id,
        ip_address=ip,
    )
    await db.commit()


async def get_hierarchy(
    db: AsyncSession, department_id: uuid.UUID
) -> DepartmentTreeNode:
    """Return the subtree rooted at department_id via a recursive CTE."""
    await _get_or_404(db, department_id)

    query = text(
        """
        WITH RECURSIVE subtree AS (
            SELECT department_id, name, parent_department_id, status
            FROM departments
            WHERE department_id = :root AND is_deleted = false
            UNION ALL
            SELECT d.department_id, d.name, d.parent_department_id, d.status
            FROM departments d
            JOIN subtree s ON d.parent_department_id = s.department_id
            WHERE d.is_deleted = false
        )
        SELECT department_id, name, parent_department_id, status FROM subtree
        """
    )
    rows = (await db.execute(query, {"root": department_id})).mappings().all()

    nodes: dict[uuid.UUID, DepartmentTreeNode] = {
        r["department_id"]: DepartmentTreeNode(
            department_id=r["department_id"],
            name=r["name"],
            parent_department_id=r["parent_department_id"],
            status=r["status"],
            children=[],
        )
        for r in rows
    }
    root: DepartmentTreeNode | None = None
    for node in nodes.values():
        if node.department_id == department_id:
            root = node
        elif node.parent_department_id in nodes:
            nodes[node.parent_department_id].children.append(node)
    return root  # type: ignore[return-value]
