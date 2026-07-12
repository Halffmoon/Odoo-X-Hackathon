import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.department import Department
from app.models.employee import Employee, Role, RoleAssignmentHistory
from app.models.user import User
from app.schemas.employee import EmployeeResponse, EmployeeUpdate
from app.utils.activity_logger import log_activity
from app.utils.notification_helper import create_notification


def _to_response(
    emp: Employee, email: str, role_code: str, department_name: str | None
) -> EmployeeResponse:
    return EmployeeResponse(
        employee_id=emp.employee_id,
        user_id=emp.user_id,
        employee_code=emp.employee_code,
        name=emp.name,
        email=email,
        phone=emp.phone,
        role_id=emp.role_id,
        role_code=role_code,
        department_id=emp.department_id,
        department_name=department_name,
        status=emp.status,
        created_on=emp.created_on,
    )


async def _row_to_response(db: AsyncSession, emp: Employee) -> EmployeeResponse:
    email = (
        await db.execute(select(User.email).where(User.user_id == emp.user_id))
    ).scalar_one()
    role_code = emp.role.role_code
    dept_name = None
    if emp.department_id:
        dept_name = (
            await db.execute(
                select(Department.name).where(
                    Department.department_id == emp.department_id
                )
            )
        ).scalar_one_or_none()
    return _to_response(emp, email, role_code, dept_name)


async def _get_or_404(db: AsyncSession, employee_id: uuid.UUID) -> Employee:
    result = await db.execute(
        select(Employee)
        .options(joinedload(Employee.role))
        .where(Employee.employee_id == employee_id, Employee.is_deleted.is_(False))
    )
    emp = result.scalar_one_or_none()
    if emp is None:
        raise HTTPException(status_code=404, detail="Employee not found.")
    return emp


async def list_employees(
    db: AsyncSession,
    department_id: uuid.UUID | None = None,
    role_code: str | None = None,
    status: str | None = None,
) -> list[EmployeeResponse]:
    stmt = (
        select(Employee, User.email, Role.role_code, Department.name)
        .join(User, User.user_id == Employee.user_id)
        .join(Role, Role.role_id == Employee.role_id)
        .join(
            Department,
            Department.department_id == Employee.department_id,
            isouter=True,
        )
        .where(Employee.is_deleted.is_(False))
    )
    if department_id:
        stmt = stmt.where(Employee.department_id == department_id)
    if role_code:
        stmt = stmt.where(Role.role_code == role_code)
    if status:
        stmt = stmt.where(Employee.status == status)
    stmt = stmt.order_by(Employee.name)

    rows = (await db.execute(stmt)).all()
    return [
        _to_response(emp, email, rc, dname) for emp, email, rc, dname in rows
    ]


async def get_employee(
    db: AsyncSession, employee_id: uuid.UUID
) -> EmployeeResponse:
    emp = await _get_or_404(db, employee_id)
    return await _row_to_response(db, emp)


async def update_employee(
    db: AsyncSession,
    employee_id: uuid.UUID,
    data: EmployeeUpdate,
    actor: Employee,
    ip: str | None,
) -> EmployeeResponse:
    emp = await _get_or_404(db, employee_id)

    is_admin = actor.role.role_code == "ADMIN"
    is_self = actor.employee_id == employee_id
    if not (is_admin or is_self):
        raise HTTPException(
            status_code=403, detail="You may only edit your own profile."
        )

    # Non-admins editing themselves may only change name + phone.
    if not is_admin:
        if data.department_id is not None or data.status is not None:
            raise HTTPException(
                status_code=403,
                detail="Only an admin can change department or status.",
            )

    old = {"name": emp.name, "phone": emp.phone, "status": emp.status}
    if data.name is not None:
        emp.name = data.name
    if data.phone is not None:
        emp.phone = data.phone
    if is_admin and data.department_id is not None:
        emp.department_id = data.department_id
    if is_admin and data.status is not None:
        emp.status = data.status
    emp.updated_by = actor.user_id
    emp.updated_on = datetime.now(timezone.utc)

    await log_activity(
        db, actor.user_id, "UPDATE_EMPLOYEE", "employees", emp.employee_id,
        old_value=old, new_value={"name": emp.name, "phone": emp.phone}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(emp)
    return await _row_to_response(db, emp)


async def promote_employee(
    db: AsyncSession,
    employee_id: uuid.UUID,
    new_role_code: str,
    actor: Employee,
    ip: str | None,
) -> EmployeeResponse:
    emp = await _get_or_404(db, employee_id)
    new_role = (
        await db.execute(select(Role).where(Role.role_code == new_role_code))
    ).scalar_one_or_none()
    if new_role is None:
        raise HTTPException(status_code=400, detail="Unknown role code.")

    if emp.role_id == new_role.role_id:
        raise HTTPException(
            status_code=409, detail="Employee already holds this role."
        )

    old_role_id = emp.role_id
    emp.role_id = new_role.role_id
    emp.updated_by = actor.user_id
    emp.updated_on = datetime.now(timezone.utc)

    db.add(
        RoleAssignmentHistory(
            employee_id=emp.employee_id,
            old_role_id=old_role_id,
            new_role_id=new_role.role_id,
            changed_by=actor.employee_id,
        )
    )

    # If promoted to DEPT_HEAD and they belong to a department, set head_employee_id.
    if new_role_code == "DEPT_HEAD" and emp.department_id:
        dept = (
            await db.execute(
                select(Department).where(
                    Department.department_id == emp.department_id
                )
            )
        ).scalar_one_or_none()
        if dept is not None:
            dept.head_employee_id = emp.employee_id
            dept.updated_by = actor.user_id
            dept.updated_on = datetime.now(timezone.utc)

    await create_notification(
        db,
        recipient_employee_id=emp.employee_id,
        type="ROLE_CHANGE",
        title="Your role has been updated",
        message=f"Your role is now {new_role_code}.",
        reference_table="employees",
        reference_id=emp.employee_id,
    )
    await log_activity(
        db, actor.user_id, "PROMOTE_EMPLOYEE", "employees", emp.employee_id,
        old_value={"role_id": old_role_id}, new_value={"role_id": new_role.role_id},
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(emp)
    return await _row_to_response(db, emp)


async def deactivate_employee(
    db: AsyncSession, employee_id: uuid.UUID, actor: Employee, ip: str | None
) -> None:
    emp = await _get_or_404(db, employee_id)
    emp.status = "INACTIVE"
    emp.is_deleted = True
    emp.updated_by = actor.user_id
    emp.updated_on = datetime.now(timezone.utc)
    await log_activity(
        db, actor.user_id, "DEACTIVATE_EMPLOYEE", "employees", emp.employee_id,
        ip_address=ip,
    )
    await db.commit()


async def get_role_history(
    db: AsyncSession, employee_id: uuid.UUID
) -> list[RoleAssignmentHistory]:
    await _get_or_404(db, employee_id)
    result = await db.execute(
        select(RoleAssignmentHistory)
        .where(RoleAssignmentHistory.employee_id == employee_id)
        .order_by(RoleAssignmentHistory.changed_on.desc())
    )
    return list(result.scalars().all())


async def list_roles(db: AsyncSession) -> list[Role]:
    result = await db.execute(select(Role).order_by(Role.role_id))
    return list(result.scalars().all())
