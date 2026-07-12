import uuid
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee
from app.schemas.dashboard import DashboardKPIs, UpcomingReturn


def _scope_for(actor: Employee) -> tuple[str, dict]:
    role = actor.role.role_code
    if role in ("ADMIN", "ASSET_MANAGER"):
        return "GLOBAL", {}
    if role == "DEPT_HEAD":
        return "DEPARTMENT", {"department_id": actor.department_id}
    return "SELF", {"employee_id": actor.employee_id}


async def get_kpis(db: AsyncSession, actor: Employee) -> DashboardKPIs:
    scope, params = _scope_for(actor)
    dept = params.get("department_id")
    emp = params.get("employee_id")

    # Asset counts: global, or scoped to the dept head's department. For an
    # employee we report the assets currently allocated to them.
    if scope == "SELF":
        avail_sql = text(
            "SELECT count(*) FROM assets a WHERE a.is_deleted=false AND a.status='AVAILABLE'"
        )
        available = (await db.execute(avail_sql)).scalar_one()
        allocated = (
            await db.execute(
                text(
                    "SELECT count(*) FROM asset_allocations "
                    "WHERE employee_id=:emp AND status='ACTIVE'"
                ),
                {"emp": emp},
            )
        ).scalar_one()
    else:
        dept_clause = " AND current_department_id=:dept" if dept else ""
        dept_param = {"dept": dept} if dept else {}
        available = (
            await db.execute(
                text(
                    "SELECT count(*) FROM assets WHERE is_deleted=false "
                    "AND status='AVAILABLE'" + dept_clause
                ),
                dept_param,
            )
        ).scalar_one()
        allocated = (
            await db.execute(
                text(
                    "SELECT count(*) FROM assets WHERE is_deleted=false "
                    "AND status='ALLOCATED'" + dept_clause
                ),
                dept_param,
            )
        ).scalar_one()

    # Maintenance in progress today.
    maint_filter = ""
    maint_params: dict = {}
    if scope == "DEPARTMENT" and dept:
        maint_filter = " AND a.current_department_id=:dept"
        maint_params["dept"] = dept
    elif scope == "SELF":
        maint_filter = " AND m.requested_by=:emp"
        maint_params["emp"] = emp
    maintenance_today = (
        await db.execute(
            text(
                "SELECT count(*) FROM maintenance_requests m JOIN assets a "
                "ON a.asset_id=m.asset_id WHERE m.status IN "
                "('APPROVED','TECHNICIAN_ASSIGNED','IN_PROGRESS') "
                "AND m.updated_on::date = current_date" + maint_filter
            ),
            maint_params,
        )
    ).scalar_one()

    # Active bookings right now.
    book_filter = ""
    book_params: dict = {}
    if scope == "DEPARTMENT" and dept:
        book_filter = " AND department_id=:dept"
        book_params["dept"] = dept
    elif scope == "SELF":
        book_filter = " AND employee_id=:emp"
        book_params["emp"] = emp
    active_bookings = (
        await db.execute(
            text(
                "SELECT count(*) FROM bookings WHERE (status='ONGOING' OR "
                "(status='UPCOMING' AND start_time <= now() AND end_time > now()))"
                + book_filter
            ),
            book_params,
        )
    ).scalar_one()

    # Pending transfers.
    if scope == "SELF":
        pending_transfers = (
            await db.execute(
                text(
                    "SELECT count(*) FROM asset_transfers WHERE status='REQUESTED' "
                    "AND (requested_by=:emp OR to_employee_id=:emp OR from_employee_id=:emp)"
                ),
                {"emp": emp},
            )
        ).scalar_one()
    elif scope == "DEPARTMENT" and dept:
        pending_transfers = (
            await db.execute(
                text(
                    "SELECT count(*) FROM asset_transfers t JOIN assets a "
                    "ON a.asset_id=t.asset_id WHERE t.status='REQUESTED' "
                    "AND a.current_department_id=:dept"
                ),
                {"dept": dept},
            )
        ).scalar_one()
    else:
        pending_transfers = (
            await db.execute(
                text("SELECT count(*) FROM asset_transfers WHERE status='REQUESTED'")
            )
        ).scalar_one()

    # Overdue returns (from the view).
    overdue_filter = ""
    overdue_params: dict = {}
    if scope == "DEPARTMENT" and dept:
        overdue_filter = " WHERE department_id=:dept"
        overdue_params["dept"] = dept
    elif scope == "SELF":
        overdue_filter = " WHERE employee_id=:emp"
        overdue_params["emp"] = emp
    overdue_returns = (
        await db.execute(
            text("SELECT count(*) FROM v_overdue_allocations" + overdue_filter),
            overdue_params,
        )
    ).scalar_one()

    # Upcoming returns within 7 days.
    up_filter = ""
    up_params: dict = {}
    if scope == "DEPARTMENT" and dept:
        up_filter = " AND al.department_id=:dept"
        up_params["dept"] = dept
    elif scope == "SELF":
        up_filter = " AND al.employee_id=:emp"
        up_params["emp"] = emp
    up_rows = (
        await db.execute(
            text(
                "SELECT al.allocation_id, al.asset_id, a.asset_tag, a.name AS asset_name, "
                "al.employee_id, al.expected_return_date, "
                "(al.expected_return_date - current_date) AS days_until_due "
                "FROM asset_allocations al JOIN assets a ON a.asset_id=al.asset_id "
                "WHERE al.status='ACTIVE' AND al.expected_return_date IS NOT NULL "
                "AND al.expected_return_date >= current_date "
                "AND al.expected_return_date <= current_date + INTERVAL '7 days'"
                + up_filter + " ORDER BY al.expected_return_date"
            ),
            up_params,
        )
    ).mappings().all()

    upcoming = [
        UpcomingReturn(
            allocation_id=r["allocation_id"],
            asset_id=r["asset_id"],
            asset_tag=r["asset_tag"],
            asset_name=r["asset_name"],
            employee_id=r["employee_id"],
            expected_return_date=r["expected_return_date"],
            days_until_due=r["days_until_due"],
        )
        for r in up_rows
    ]

    return DashboardKPIs(
        scope=scope,
        assets_available=available,
        assets_allocated=allocated,
        maintenance_today=maintenance_today,
        active_bookings=active_bookings,
        pending_transfers=pending_transfers,
        overdue_returns=overdue_returns,
        upcoming_returns=upcoming,
    )
