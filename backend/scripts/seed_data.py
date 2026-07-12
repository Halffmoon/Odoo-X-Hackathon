"""
AssetFlow Seed Data Script
Run:  python -m scripts.seed_data   (from the backend/ directory)

Populates every table with realistic, interconnected test data:
locations, departments (hierarchy), users/employees (all roles), categories +
custom fields, assets (+ custom values, status history), allocations, transfers,
bookings, maintenance, audit cycles (+ auto-generated discrepancies via triggers),
notifications, and activity logs.

Idempotent:
- Master rows are get-or-create by natural key (email / serial / name).
- Transactional rows are guarded by a sentinel activity log, so re-running does
  not pile up duplicate allocations/bookings/etc.

DB triggers are relied upon (never bypassed):
- allocation ACTIVE            -> asset ALLOCATED
- maintenance status change    -> asset UNDER_MAINTENANCE / AVAILABLE
- audit result MISSING/DAMAGED -> discrepancy row
- audit cycle -> CLOSED        -> MISSING assets become LOST
"""
import asyncio
import random
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.database import async_session_maker
from app.models.allocation import AllocationHistory, AssetAllocation
from app.models.asset import (
    Asset,
    AssetAttachment,
    AssetCustomFieldValue,
    AssetStatusHistory,
)
from app.models.audit import (
    AuditAssignment,
    AuditCycle,
    AuditDiscrepancy,
    AuditResult,
)
from app.models.booking import Booking, BookingHistory
from app.models.category import AssetCategory, CategoryCustomField
from app.models.department import Department
from app.models.employee import Employee, Role
from app.models.location import Location
from app.models.maintenance import MaintenanceHistory, MaintenanceRequest
from app.models.notification import ActivityLog, Notification
from app.models.transfer import AssetTransfer
from app.models.user import User
from app.utils.security import hash_password
from app.utils.tag_generator import generate_next_tag

SENTINEL_ACTION = "SEED_DATA_TRANSACTIONAL"
now = datetime.now(timezone.utc)
today = date.today()


# --------------------------------------------------------------------------- #
# get-or-create helpers (idempotent master data)
# --------------------------------------------------------------------------- #
async def role_map(db) -> dict[str, int]:
    rows = (await db.execute(select(Role))).scalars().all()
    return {r.role_code: r.role_id for r in rows}


async def goc_location(db, name, address) -> Location:
    row = (await db.execute(select(Location).where(Location.name == name))).scalar_one_or_none()
    if row:
        return row
    row = Location(name=name, address=address)
    db.add(row)
    await db.flush()
    return row


async def goc_department(db, name, parent_id=None) -> Department:
    stmt = select(Department).where(Department.name == name)
    stmt = stmt.where(
        Department.parent_department_id.is_(None)
        if parent_id is None
        else Department.parent_department_id == parent_id
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row:
        return row
    row = Department(name=name, parent_department_id=parent_id)
    db.add(row)
    await db.flush()
    return row


async def goc_category(db, name, description) -> AssetCategory:
    row = (await db.execute(select(AssetCategory).where(AssetCategory.name == name))).scalar_one_or_none()
    if row:
        return row
    row = AssetCategory(name=name, description=description)
    db.add(row)
    await db.flush()
    return row


async def goc_field(db, category_id, field_name, field_type, required=False) -> CategoryCustomField:
    row = (
        await db.execute(
            select(CategoryCustomField).where(
                CategoryCustomField.category_id == category_id,
                CategoryCustomField.field_name == field_name,
            )
        )
    ).scalar_one_or_none()
    if row:
        return row
    row = CategoryCustomField(
        category_id=category_id, field_name=field_name, field_type=field_type, is_required=required
    )
    db.add(row)
    await db.flush()
    return row


async def goc_employee(db, email, password, name, role_id, department_id, phone) -> Employee:
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        user = User(email=email, password_hash=hash_password(password))
        db.add(user)
        await db.flush()
    emp = (await db.execute(select(Employee).where(Employee.user_id == user.user_id))).scalar_one_or_none()
    if emp is None:
        code = await generate_next_tag(db, Employee, "employee_code", "EMP")
        emp = Employee(
            user_id=user.user_id, employee_code=code, name=name, phone=phone,
            role_id=role_id, department_id=department_id,
        )
        db.add(emp)
        await db.flush()
    return emp


async def goc_asset(db, *, name, serial, category_id, location_id, department_id,
                    is_bookable, condition, cost, acquired) -> Asset:
    row = (await db.execute(select(Asset).where(Asset.serial_number == serial))).scalar_one_or_none()
    if row:
        return row
    tag = await generate_next_tag(db, Asset, "asset_tag", "AF")
    row = Asset(
        asset_tag=tag, name=name, category_id=category_id, serial_number=serial,
        acquisition_date=acquired, acquisition_cost=Decimal(cost), condition=condition,
        location_id=location_id, current_department_id=department_id, is_bookable=is_bookable,
    )
    db.add(row)
    await db.flush()
    db.add(
        AssetStatusHistory(
            asset_id=row.asset_id, old_status=None, new_status="AVAILABLE",
            reason="Asset registered (seed)",
        )
    )
    return row


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
async def seed() -> None:
    random.seed(42)
    async with async_session_maker() as db:
        roles = await role_map(db)
        if not roles:
            raise SystemExit("Roles are not seeded. Run `alembic upgrade head` first.")

        # 1. Locations ------------------------------------------------------ #
        locs = {
            "hq": await goc_location(db, "Head Office — Mumbai", "Nariman Point, Mumbai"),
            "delhi": await goc_location(db, "Branch Office — Delhi", "Connaught Place, New Delhi"),
            "pune": await goc_location(db, "Warehouse — Pune", "Hinjewadi Phase 2, Pune"),
            "blr": await goc_location(db, "Workshop — Bangalore", "Whitefield, Bengaluru"),
            "hyd": await goc_location(db, "Conference Center — Hyderabad", "HITEC City, Hyderabad"),
        }
        print(f"[ok] Locations: {len(locs)}")

        # 2. Departments (hierarchy) --------------------------------------- #
        tech = await goc_department(db, "Technology")
        deps = {
            "tech": tech,
            "swe": await goc_department(db, "Software Engineering", tech.department_id),
            "infra": await goc_department(db, "IT Infrastructure", tech.department_id),
            "ops": await goc_department(db, "Operations"),
            "hr": await goc_department(db, "Human Resources"),
            "fin": await goc_department(db, "Finance"),
        }
        print(f"[ok] Departments: {len(deps)}")

        # 3+4. Users & Employees ------------------------------------------- #
        E = roles["EMPLOYEE"]; DH = roles["DEPT_HEAD"]; AM = roles["ASSET_MANAGER"]; AD = roles["ADMIN"]
        emp = {}
        emp["admin"] = await goc_employee(db, "admin@assetflow.com", "Admin@123", "Aditi Rao", AD, deps["tech"].department_id, "+91 90000 00001")
        emp["mgr1"] = await goc_employee(db, "asset.mgr1@assetflow.com", "AssetMgr@123", "Vikram Sethi", AM, deps["ops"].department_id, "+91 90000 00002")
        emp["mgr2"] = await goc_employee(db, "asset.mgr2@assetflow.com", "AssetMgr@123", "Neha Kulkarni", AM, deps["infra"].department_id, "+91 90000 00003")
        emp["head_tech"] = await goc_employee(db, "head.tech@assetflow.com", "Head@123", "Rahul Menon", DH, deps["tech"].department_id, "+91 90000 00004")
        emp["head_ops"] = await goc_employee(db, "head.ops@assetflow.com", "Head@123", "Sunita Pillai", DH, deps["ops"].department_id, "+91 90000 00005")
        emp["head_hr"] = await goc_employee(db, "head.hr@assetflow.com", "Head@123", "Imran Sheikh", DH, deps["hr"].department_id, "+91 90000 00006")
        staff_specs = [
            ("priya.nair@assetflow.com", "Priya Nair", "swe"),
            ("rohan.iyer@assetflow.com", "Rohan Iyer", "swe"),
            ("sana.qureshi@assetflow.com", "Sana Qureshi", "infra"),
            ("arjun.mehta@assetflow.com", "Arjun Mehta", "infra"),
            ("kavya.reddy@assetflow.com", "Kavya Reddy", "ops"),
            ("dev.sharma@assetflow.com", "Dev Sharma", "ops"),
            ("meera.joshi@assetflow.com", "Meera Joshi", "hr"),
            ("ali.khan@assetflow.com", "Ali Khan", "fin"),
            ("tara.das@assetflow.com", "Tara Das", "fin"),
            ("nikhil.rao@assetflow.com", "Nikhil Rao", "swe"),
            ("fatima.sheikh@assetflow.com", "Fatima Sheikh", "ops"),
            ("gaurav.malhotra@assetflow.com", "Gaurav Malhotra", "infra"),
        ]
        for i, (mail, nm, dk) in enumerate(staff_specs):
            emp[f"e{i}"] = await goc_employee(db, mail, "Employee@123", nm, E, deps[dk].department_id, f"+91 98{i:03d} 10000")
        print(f"[ok] Users & Employees: {len(emp)}")

        # 5. Department heads --------------------------------------------- #
        for dk, ek in [("tech", "head_tech"), ("ops", "head_ops"), ("hr", "head_hr")]:
            deps[dk].head_employee_id = emp[ek].employee_id
        await db.flush()

        # 6. Categories + custom fields ----------------------------------- #
        cat = {}
        cat["elec"] = await goc_category(db, "Electronics", "Laptops, phones and peripherals")
        await goc_field(db, cat["elec"].category_id, "warranty_period", "NUMBER")
        await goc_field(db, cat["elec"].category_id, "brand", "TEXT")
        cat["furn"] = await goc_category(db, "Furniture", "Desks, chairs and fittings")
        await goc_field(db, cat["furn"].category_id, "material", "TEXT")
        await goc_field(db, cat["furn"].category_id, "weight_kg", "NUMBER")
        cat["veh"] = await goc_category(db, "Vehicles", "Company cars and vans")
        await goc_field(db, cat["veh"].category_id, "license_plate", "TEXT")
        await goc_field(db, cat["veh"].category_id, "fuel_type", "TEXT")
        await goc_field(db, cat["veh"].category_id, "last_service_date", "DATE")
        cat["it"] = await goc_category(db, "IT Equipment", "Servers, projectors and networking")
        await goc_field(db, cat["it"].category_id, "ip_address", "TEXT")
        await goc_field(db, cat["it"].category_id, "mac_address", "TEXT")
        cat["off"] = await goc_category(db, "Office Supplies", "Consumables and stationery")
        cat["lab"] = await goc_category(db, "Lab Equipment", "Measurement and test gear")
        await goc_field(db, cat["lab"].category_id, "calibration_due", "DATE")
        await goc_field(db, cat["lab"].category_id, "is_hazardous", "BOOLEAN")
        print(f"[ok] Categories: {len(cat)}")

        # 7. Assets -------------------------------------------------------- #
        assets: list[Asset] = []

        def acq(days_ago):
            return today - timedelta(days=days_ago)

        elec_specs = [
            ("Dell Latitude 5440", "Dell", "GOOD", "72500"),
            ("MacBook Pro 14", "Apple", "NEW", "210000"),
            ("Lenovo ThinkPad X1", "Lenovo", "GOOD", "138000"),
            ("HP EliteBook 840", "HP", "FAIR", "96000"),
            ("iPhone 14", "Apple", "GOOD", "72000"),
            ("Samsung Galaxy S23", "Samsung", "GOOD", "78000"),
            ("Logitech MX Master", "Logitech", "NEW", "9500"),
            ("Dell UltraSharp 27", "Dell", "GOOD", "38000"),
        ]
        for i, (nm, brand, cond, cost) in enumerate(elec_specs):
            a = await goc_asset(db, name=nm, serial=f"SN-ELEC-{i:04d}", category_id=cat["elec"].category_id,
                                location_id=locs["hq"].location_id, department_id=deps["swe"].department_id,
                                is_bookable=False, condition=cond, cost=cost, acquired=acq(120 + i * 40))
            assets.append(a)

        furn_specs = [
            ("Ergo Chair Type B", "Mesh", "18.5", "GOOD"),
            ("Standing Desk 120cm", "Oak", "34.0", "GOOD"),
            ("Conference Table 8-seat", "Walnut", "80.0", "FAIR"),
            ("Filing Cabinet 4-drawer", "Steel", "42.0", "GOOD"),
            ("Reception Sofa", "Leather", "55.0", "FAIR"),
        ]
        for i, (nm, mat, wt, cond) in enumerate(furn_specs):
            a = await goc_asset(db, name=nm, serial=f"SN-FURN-{i:04d}", category_id=cat["furn"].category_id,
                                location_id=locs["hq"].location_id, department_id=deps["hr"].department_id,
                                is_bookable=False, condition=cond, cost="22000", acquired=acq(300 + i * 60))
            assets.append(a)

        veh_specs = [
            ("Toyota Innova Crysta", "MH01AB1234", "Diesel", True),
            ("Maruti Ertiga", "MH02CD5678", "Petrol", True),
            ("Tata Ace (Fleet)", "MH03EF9012", "Diesel", True),
            ("Bajaj Pulsar (Fleet)", "MH04GH3456", "Petrol", True),
        ]
        for i, (nm, plate, fuel, book) in enumerate(veh_specs):
            a = await goc_asset(db, name=nm, serial=f"SN-VEH-{i:04d}", category_id=cat["veh"].category_id,
                                location_id=locs["pune"].location_id, department_id=deps["ops"].department_id,
                                is_bookable=book, condition="GOOD", cost="1500000", acquired=acq(500 + i * 90))
            assets.append(a)

        it_specs = [
            ("Dell PowerEdge R740", locs["hq"], deps["infra"], False),
            ("Epson EB-2247U Projector", locs["hyd"], deps["ops"], True),
            ("Cisco Catalyst 9200", locs["hq"], deps["infra"], False),
            ("BenQ Projector MW612", locs["hyd"], deps["ops"], True),
            ("Conference Room A (HYD)", locs["hyd"], deps["ops"], True),
            ("Conference Room B (HQ)", locs["hq"], deps["swe"], True),
        ]
        for i, (nm, loc, dep, book) in enumerate(it_specs):
            a = await goc_asset(db, name=nm, serial=f"SN-IT-{i:04d}", category_id=cat["it"].category_id,
                                location_id=loc.location_id, department_id=dep.department_id,
                                is_bookable=book, condition="GOOD", cost="85000", acquired=acq(200 + i * 30))
            assets.append(a)

        for i in range(4):
            a = await goc_asset(db, name=f"Office Printer HP-{i+1}", serial=f"SN-OFF-{i:04d}", category_id=cat["off"].category_id,
                                location_id=locs["delhi"].location_id, department_id=deps["fin"].department_id,
                                is_bookable=False, condition="GOOD", cost="15000", acquired=acq(150 + i * 20))
            assets.append(a)

        for i in range(4):
            a = await goc_asset(db, name=f"Digital Multimeter DM-{i+1}", serial=f"SN-LAB-{i:04d}", category_id=cat["lab"].category_id,
                                location_id=locs["blr"].location_id, department_id=deps["infra"].department_id,
                                is_bookable=False, condition="FAIR" if i % 2 else "POOR", cost="45000", acquired=acq(900 + i * 30))
            assets.append(a)
        print(f"[ok] Assets: {len(assets)}")

        # custom field values for a few assets (matching their category fields)
        async def set_values(asset: Asset, values: dict[str, object]):
            fields = (
                await db.execute(select(CategoryCustomField).where(CategoryCustomField.category_id == asset.category_id))
            ).scalars().all()
            by_name = {f.field_name: f for f in fields}
            for fname, val in values.items():
                f = by_name.get(fname)
                if not f:
                    continue
                exists = (
                    await db.execute(
                        select(AssetCustomFieldValue).where(
                            AssetCustomFieldValue.asset_id == asset.asset_id,
                            AssetCustomFieldValue.field_id == f.field_id,
                        )
                    )
                ).scalar_one_or_none()
                if exists:
                    continue
                cols = dict(text_value=None, number_value=None, date_value=None, boolean_value=None)
                if f.field_type == "TEXT":
                    cols["text_value"] = str(val)
                elif f.field_type == "NUMBER":
                    cols["number_value"] = Decimal(str(val))
                elif f.field_type == "DATE":
                    cols["date_value"] = val
                elif f.field_type == "BOOLEAN":
                    cols["boolean_value"] = bool(val)
                db.add(AssetCustomFieldValue(asset_id=asset.asset_id, field_id=f.field_id, **cols))

        await set_values(assets[0], {"warranty_period": 24, "brand": "Dell"})
        await set_values(assets[1], {"warranty_period": 12, "brand": "Apple"})
        await set_values(assets[16], {"license_plate": "MH01AB1234", "fuel_type": "Diesel", "last_service_date": acq(40)})
        await db.flush()

        # sentinel check for transactional data
        seeded = (
            await db.execute(select(ActivityLog).where(ActivityLog.action == SENTINEL_ACTION))
        ).scalar_one_or_none()
        if seeded is not None:
            await db.commit()
            print("[ok] Transactional data already seeded (sentinel present) — skipping.")
            print("Seed data loaded successfully!")
            return

        admin_id = emp["admin"].employee_id
        mgr1 = emp["mgr1"].employee_id
        staff = [emp[f"e{i}"] for i in range(len(staff_specs))]

        # 8. Allocations --------------------------------------------------- #
        # Use distinct assets so triggers don't clash with maintenance targets.
        alloc_pool = assets[:8] + [assets[9], assets[16], assets[17]]  # electronics + a chair + 2 vehicles
        n_alloc = 0
        # active (10)
        for i, a in enumerate(alloc_pool[:10]):
            holder = staff[i % len(staff)]
            if i < 3:
                exp = today - timedelta(days=5 + i * 3)   # overdue
                adate = exp - timedelta(days=20)
            elif i < 5:
                exp = today + timedelta(days=2 + i)        # upcoming return
                adate = today - timedelta(days=10)
            else:
                exp = today + timedelta(days=40)
                adate = today - timedelta(days=15)
            al = AssetAllocation(
                asset_id=a.asset_id, employee_id=holder.employee_id, allocation_date=adate,
                expected_return_date=exp, status="ACTIVE", allocated_by=mgr1,
            )
            db.add(al)
            await db.flush()  # trigger -> asset ALLOCATED
            db.add(AllocationHistory(allocation_id=al.allocation_id, action="ALLOCATED", performed_by=mgr1))
            n_alloc += 1
        # returned/historical (5) on furniture assets
        for i, a in enumerate(assets[10:15]):
            holder = staff[(i + 2) % len(staff)]
            adate = today - timedelta(days=120 - i * 10)
            rdate = adate + timedelta(days=30)
            al = AssetAllocation(
                asset_id=a.asset_id, employee_id=holder.employee_id, allocation_date=adate,
                expected_return_date=adate + timedelta(days=45), actual_return_date=rdate,
                return_condition="GOOD", return_notes="Returned in good condition (seed).",
                status="RETURNED", allocated_by=mgr1,
            )
            db.add(al)
            await db.flush()
            db.add(AllocationHistory(allocation_id=al.allocation_id, action="ALLOCATED", performed_by=mgr1))
            db.add(AllocationHistory(allocation_id=al.allocation_id, action="RETURNED", performed_by=mgr1))
            n_alloc += 1
        print(f"[ok] Allocations: {n_alloc}")

        # 9. Transfers ----------------------------------------------------- #
        n_tr = 0
        # COMPLETED transfers on two currently-active assets
        for i in range(2):
            a = alloc_pool[5 + i]
            frm = staff[(5 + i) % len(staff)].employee_id
            to = staff[(7 + i) % len(staff)].employee_id
            db.add(AssetTransfer(asset_id=a.asset_id, from_employee_id=frm, to_employee_id=to,
                                 requested_by=frm, approved_by=mgr1, status="COMPLETED",
                                 requested_on=now - timedelta(days=10 - i), approved_on=now - timedelta(days=9 - i),
                                 completed_on=now - timedelta(days=9 - i), remarks="Team reassignment (seed)."))
            n_tr += 1
        # REQUESTED (pending)
        for i in range(2):
            a = alloc_pool[i]
            frm = staff[i % len(staff)].employee_id
            to = staff[(i + 4) % len(staff)].employee_id
            db.add(AssetTransfer(asset_id=a.asset_id, from_employee_id=frm, to_employee_id=to,
                                 requested_by=frm, status="REQUESTED", requested_on=now - timedelta(days=1),
                                 remarks="Requesting transfer (seed)."))
            n_tr += 1
        # REJECTED
        db.add(AssetTransfer(asset_id=alloc_pool[2].asset_id, from_employee_id=staff[2].employee_id,
                             to_employee_id=staff[6].employee_id, requested_by=staff[2].employee_id,
                             approved_by=mgr1, status="REJECTED", requested_on=now - timedelta(days=5),
                             approved_on=now - timedelta(days=4), remarks="Not approved — asset needed locally."))
        n_tr += 1
        await db.flush()
        print(f"[ok] Transfers: {n_tr}")

        # 10. Bookings ----------------------------------------------------- #
        bookable = [a for a in assets if a.is_bookable]
        n_bk = 0

        def slot(day_offset, hour, dur=1):
            base = datetime.combine(today + timedelta(days=day_offset), time(hour, 0, tzinfo=timezone.utc))
            return base, base + timedelta(hours=dur)

        booking_plan = [
            (bookable[0], 2, 10, "UPCOMING", "Client demo"),
            (bookable[0], 3, 14, "UPCOMING", "Sprint planning"),
            (bookable[1], 2, 9, "UPCOMING", "Site visit"),
            (bookable[2], 4, 11, "UPCOMING", "Training session"),
            (bookable[3], 5, 15, "UPCOMING", "Board meeting"),
            (bookable[0], -3, 10, "COMPLETED", "Retro"),
            (bookable[1], -5, 9, "COMPLETED", "Delivery run"),
            (bookable[2], -2, 13, "COMPLETED", "Workshop"),
            (bookable[3], -7, 16, "CANCELLED", "Cancelled review"),
            (bookable[0], -6, 12, "CANCELLED", "Cancelled sync"),
        ]
        for a, doff, hr, st, purpose in booking_plan:
            s, e = slot(doff, hr)
            b = Booking(asset_id=a.asset_id, employee_id=staff[n_bk % len(staff)].employee_id,
                        department_id=None, start_time=s, end_time=e, status=st, purpose=purpose,
                        created_by=staff[n_bk % len(staff)].user_id)
            db.add(b)
            await db.flush()  # trigger backfills department_id
            db.add(BookingHistory(booking_id=b.booking_id, action="CREATED", performed_by=b.employee_id))
            if st == "CANCELLED":
                db.add(BookingHistory(booking_id=b.booking_id, action="CANCELLED", performed_by=b.employee_id))
            n_bk += 1
        print(f"[ok] Bookings: {n_bk}")

        # 11. Maintenance -------------------------------------------------- #
        # Targets must be AVAILABLE assets that no audit touches (office + lab
        # sit in Finance/Infra, outside the SWE/Ops audit scopes) so a cycle-close
        # LOST transition never collides with an in-progress maintenance.
        maint_available = [
            a for a in assets
            if a.category_id in (cat["off"].category_id, cat["lab"].category_id)
        ]
        n_m = 0

        async def make_maintenance(asset, requester, issue, priority, target, technician=None):
            m = MaintenanceRequest(asset_id=asset.asset_id, requested_by=requester,
                                   issue_description=issue, priority=priority, status="PENDING")
            db.add(m)
            await db.flush()
            db.add(MaintenanceHistory(maintenance_id=m.maintenance_id, action="RAISED", performed_by=requester))
            path = ["APPROVED", "TECHNICIAN_ASSIGNED", "IN_PROGRESS", "RESOLVED"]
            if target == "REJECTED":
                m.approved_by = mgr1
                m.approved_on = now
                m.status = "REJECTED"
                await db.flush()  # trigger
                db.add(MaintenanceHistory(maintenance_id=m.maintenance_id, action="REJECTED", performed_by=mgr1))
                return m
            for step in path:
                if step == "APPROVED":
                    m.approved_by = mgr1
                    m.approved_on = now
                if step == "TECHNICIAN_ASSIGNED" and technician:
                    m.technician_id = technician
                if step == "RESOLVED":
                    m.resolved_on = now
                    m.resolution_notes = "Repaired and tested (seed)."
                m.status = step
                await db.flush()  # each update fires the status-sync trigger
                db.add(MaintenanceHistory(maintenance_id=m.maintenance_id, action=step, performed_by=technician or mgr1))
                if step == target:
                    break
            return m

        tech1 = emp["mgr2"].employee_id
        plans = [
            (maint_available[0], "Paper jam recurring", "MEDIUM", "PENDING", None),
            (maint_available[1], "Toner leakage", "LOW", "PENDING", None),
            (maint_available[2], "Calibration drift", "HIGH", "APPROVED", None),
            (maint_available[3], "Display flicker", "MEDIUM", "TECHNICIAN_ASSIGNED", tech1),
            (maint_available[4], "Probe not reading", "HIGH", "IN_PROGRESS", tech1),
            (maint_available[5], "Overheating", "CRITICAL", "IN_PROGRESS", tech1),
            (maint_available[0], "Fuser replacement", "MEDIUM", "RESOLVED", tech1),
            (maint_available[2], "Annual service", "LOW", "RESOLVED", tech1),
            (maint_available[3], "Firmware update", "LOW", "RESOLVED", tech1),
            (maint_available[1], "Wrong request", "LOW", "REJECTED", None),
        ]
        for asset, issue, pri, target, tch in plans:
            m = await make_maintenance(asset, staff[n_m % len(staff)].employee_id, issue, pri, target, tch)
            n_m += 1
        # a couple of attachments on maintenance requests
        first_m = (await db.execute(select(MaintenanceRequest).limit(1))).scalar_one()
        db.add(AssetAttachment(asset_id=None, maintenance_id=first_m.maintenance_id,
                               file_url="/uploads/maintenance/seed-photo-1.jpg", file_type="PHOTO",
                               uploaded_by=first_m.requested_by))
        await db.flush()
        print(f"[ok] Maintenance requests: {n_m}")

        # 12. Audit cycles ------------------------------------------------- #
        auditors = [staff[0].employee_id, staff[1].employee_id, emp["mgr2"].employee_id]

        # CLOSED cycle (Software Engineering scope) — build results then close.
        closed = AuditCycle(name="Q1 SWE Asset Audit", department_id=deps["swe"].department_id,
                            start_date=today - timedelta(days=60), end_date=today - timedelta(days=45),
                            status="IN_PROGRESS", created_by=emp["admin"].user_id)
        db.add(closed)
        await db.flush()
        for aid in auditors[:2]:
            db.add(AuditAssignment(audit_cycle_id=closed.audit_cycle_id, auditor_employee_id=aid))
        swe_assets = [a for a in assets if a.current_department_id == deps["swe"].department_id]
        # findings: mostly verified, one damaged, one missing
        for i, a in enumerate(swe_assets):
            if i == len(swe_assets) - 1 and len(swe_assets) > 2:
                finding = "MISSING"
            elif i == 0 and len(swe_assets) > 1:
                finding = "DAMAGED"
            else:
                finding = "VERIFIED"
            db.add(AuditResult(audit_cycle_id=closed.audit_cycle_id, asset_id=a.asset_id,
                               auditor_employee_id=auditors[0], finding=finding,
                               remarks=None if finding == "VERIFIED" else f"{finding.title()} during audit (seed)."))
            await db.flush()  # trigger auto-creates discrepancy for MISSING/DAMAGED
        closed.status = "CLOSED"
        closed.closed_by = emp["admin"].employee_id
        closed.closed_on = now
        await db.flush()  # trigger marks MISSING asset LOST
        # resolve one discrepancy, leave the rest open
        discs = (await db.execute(
            select(AuditDiscrepancy).join(AuditResult, AuditResult.audit_result_id == AuditDiscrepancy.audit_result_id)
            .where(AuditResult.audit_cycle_id == closed.audit_cycle_id)
        )).scalars().all()
        if discs:
            discs[0].status = "RESOLVED"
            discs[0].resolved_by = mgr1
            discs[0].resolved_on = now
            discs[0].resolution_notes = "Asset located and re-tagged (seed)."

        # IN_PROGRESS cycle (Ops scope) — partial results.
        inprog = AuditCycle(name="Ops Fleet Audit", department_id=deps["ops"].department_id,
                            start_date=today - timedelta(days=5), end_date=today + timedelta(days=10),
                            status="IN_PROGRESS", created_by=emp["admin"].user_id)
        db.add(inprog)
        await db.flush()
        for aid in auditors:
            db.add(AuditAssignment(audit_cycle_id=inprog.audit_cycle_id, auditor_employee_id=aid))
        ops_assets = [a for a in assets if a.current_department_id == deps["ops"].department_id][:2]
        for a in ops_assets:
            db.add(AuditResult(audit_cycle_id=inprog.audit_cycle_id, asset_id=a.asset_id,
                               auditor_employee_id=auditors[0], finding="VERIFIED"))
        await db.flush()

        # PLANNED cycle (Infra scope) — auditors only, no results.
        planned = AuditCycle(name="Infra Datacenter Audit", location_id=locs["hq"].location_id,
                             start_date=today + timedelta(days=15), end_date=today + timedelta(days=25),
                             status="PLANNED", created_by=emp["admin"].user_id)
        db.add(planned)
        await db.flush()
        for aid in auditors[:2]:
            db.add(AuditAssignment(audit_cycle_id=planned.audit_cycle_id, auditor_employee_id=aid))
        await db.flush()
        print("[ok] Audit cycles: 3 (closed / in-progress / planned)")

        # 13. Notifications ----------------------------------------------- #
        notif_types = [
            ("ALLOCATION", "Asset allocated to you", "An asset has been allocated to you."),
            ("MAINTENANCE_APPROVED", "Maintenance approved", "Your maintenance request was approved."),
            ("BOOKING_CONFIRMED", "Booking confirmed", "Your resource booking is confirmed."),
            ("TRANSFER_REQUEST", "Transfer requested", "A transfer is awaiting your approval."),
            ("ASSET_DAMAGED", "Asset returned damaged", "An asset was returned in DAMAGED condition."),
            ("AUDIT_ASSIGNED", "Audit assignment", "You have been assigned to an audit cycle."),
        ]
        n_notif = 0
        for i in range(24):
            t = notif_types[i % len(notif_types)]
            recipient = staff[i % len(staff)].employee_id
            db.add(Notification(recipient_employee_id=recipient, type=t[0], title=t[1], message=t[2],
                                is_read=(i % 3 == 0), created_on=now - timedelta(hours=i * 3)))
            n_notif += 1
        print(f"[ok] Notifications: {n_notif}")

        # 14. Activity logs ----------------------------------------------- #
        log_specs = [
            ("REGISTER_ASSET", "assets", {"name": "Dell Latitude 5440"}),
            ("ALLOCATE_ASSET", "asset_allocations", {"status": "ACTIVE"}),
            ("APPROVE_TRANSFER", "asset_transfers", {"status": "COMPLETED"}),
            ("APPROVE_MAINTENANCE", "maintenance_requests", {"status": "APPROVED"}),
            ("CLOSE_AUDIT_CYCLE", "audit_cycles", {"status": "CLOSED"}),
            ("CREATE_BOOKING", "bookings", {"status": "UPCOMING"}),
        ]
        for i in range(36):
            spec = log_specs[i % len(log_specs)]
            actor = (emp["admin"] if i % 6 == 0 else emp["mgr1"]).user_id
            db.add(ActivityLog(actor_user_id=actor, action=spec[0], entity_table=spec[1],
                               old_value=None, new_value=spec[2], ip_address="127.0.0.1",
                               created_on=now - timedelta(hours=i * 2)))
        print("[ok] Activity logs: 36")

        # sentinel so transactional data isn't re-seeded
        db.add(ActivityLog(actor_user_id=emp["admin"].user_id, action=SENTINEL_ACTION,
                           entity_table=None, new_value={"seeded_on": now.isoformat()}))

        await db.commit()
        print("\nSeed data loaded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
