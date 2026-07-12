"""Seed a realistic demo dataset: departments, locations, categories +
custom fields, employees (across all roles), and assets.

Usage (from backend/, venv active):
    python -m scripts.seed_dummy_data

Idempotent by natural keys — re-running will not create duplicates.
All seeded users share the password ``password123``.
"""
import asyncio
from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.database import async_session_maker
from app.models.asset import Asset
from app.models.category import AssetCategory, CategoryCustomField
from app.models.department import Department
from app.models.employee import Employee, Role
from app.models.location import Location
from app.models.user import User
from app.utils.security import hash_password
from app.utils.tag_generator import generate_next_tag

DEFAULT_PASSWORD = "password123"


async def _role_map(db) -> dict[str, int]:
    roles = (await db.execute(select(Role))).scalars().all()
    return {r.role_code: r.role_id for r in roles}


async def _get_or_create_department(db, name, parent_id=None) -> Department:
    existing = (
        await db.execute(
            select(Department).where(
                Department.name == name,
                Department.parent_department_id.is_(parent_id)
                if parent_id is None
                else Department.parent_department_id == parent_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    dept = Department(name=name, parent_department_id=parent_id)
    db.add(dept)
    await db.flush()
    return dept


async def _get_or_create_location(db, name, address) -> Location:
    existing = (
        await db.execute(select(Location).where(Location.name == name))
    ).scalar_one_or_none()
    if existing:
        return existing
    loc = Location(name=name, address=address)
    db.add(loc)
    await db.flush()
    return loc


async def _get_or_create_category(db, name, description) -> AssetCategory:
    existing = (
        await db.execute(select(AssetCategory).where(AssetCategory.name == name))
    ).scalar_one_or_none()
    if existing:
        return existing
    cat = AssetCategory(name=name, description=description)
    db.add(cat)
    await db.flush()
    return cat


async def _get_or_create_field(db, category_id, field_name, field_type, required):
    existing = (
        await db.execute(
            select(CategoryCustomField).where(
                CategoryCustomField.category_id == category_id,
                CategoryCustomField.field_name == field_name,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    field = CategoryCustomField(
        category_id=category_id,
        field_name=field_name,
        field_type=field_type,
        is_required=required,
    )
    db.add(field)
    await db.flush()
    return field


async def _get_or_create_employee(db, email, name, role_id, department_id, phone):
    user = (
        await db.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is None:
        user = User(email=email, password_hash=hash_password(DEFAULT_PASSWORD))
        db.add(user)
        await db.flush()
    emp = (
        await db.execute(select(Employee).where(Employee.user_id == user.user_id))
    ).scalar_one_or_none()
    if emp is None:
        code = await generate_next_tag(db, Employee, "employee_code", "EMP")
        emp = Employee(
            user_id=user.user_id,
            employee_code=code,
            name=name,
            phone=phone,
            role_id=role_id,
            department_id=department_id,
        )
        db.add(emp)
        await db.flush()
    return emp


async def _get_or_create_asset(db, name, serial, category_id, location_id,
                               department_id, is_bookable, condition, cost):
    existing = (
        await db.execute(select(Asset).where(Asset.serial_number == serial))
    ).scalar_one_or_none()
    if existing:
        return existing
    tag = await generate_next_tag(db, Asset, "asset_tag", "AF")
    asset = Asset(
        asset_tag=tag,
        name=name,
        category_id=category_id,
        serial_number=serial,
        acquisition_date=date(2024, 1, 15),
        acquisition_cost=Decimal(cost),
        condition=condition,
        location_id=location_id,
        current_department_id=department_id,
        is_bookable=is_bookable,
    )
    db.add(asset)
    await db.flush()
    return asset


async def seed() -> None:
    async with async_session_maker() as db:
        roles = await _role_map(db)

        # --- Departments (with a small hierarchy) ---
        engineering = await _get_or_create_department(db, "Engineering")
        backend = await _get_or_create_department(db, "Backend Team", engineering.department_id)
        frontend = await _get_or_create_department(db, "Frontend Team", engineering.department_id)
        it_dept = await _get_or_create_department(db, "IT")
        hr = await _get_or_create_department(db, "Human Resources")
        finance = await _get_or_create_department(db, "Finance")
        ops = await _get_or_create_department(db, "Operations")

        # --- Locations ---
        floor1 = await _get_or_create_location(db, "HQ - Floor 1", "221B Baker Street, Floor 1")
        floor2 = await _get_or_create_location(db, "HQ - Floor 2", "221B Baker Street, Floor 2")
        warehouse = await _get_or_create_location(db, "Warehouse A", "Industrial Estate, Unit 7")

        # --- Categories + custom fields ---
        laptops = await _get_or_create_category(db, "Laptops", "Portable computers")
        await _get_or_create_field(db, laptops.category_id, "RAM (GB)", "NUMBER", True)
        await _get_or_create_field(db, laptops.category_id, "Warranty Expiry", "DATE", False)
        monitors = await _get_or_create_category(db, "Monitors", "External displays")
        rooms = await _get_or_create_category(db, "Meeting Rooms", "Bookable conference rooms")
        await _get_or_create_field(db, rooms.category_id, "Seating Capacity", "NUMBER", True)
        await _get_or_create_field(db, rooms.category_id, "Has Projector", "BOOLEAN", False)
        vehicles = await _get_or_create_category(db, "Vehicles", "Company vehicles")
        furniture = await _get_or_create_category(db, "Furniture", "Office furniture")

        # --- Employees ---
        await _get_or_create_employee(db, "manager1@assetflow.com", "Maya Manager", roles["ASSET_MANAGER"], it_dept.department_id, "+11111111111")
        await _get_or_create_employee(db, "manager2@assetflow.com", "Milan Manager", roles["ASSET_MANAGER"], ops.department_id, "+11111111112")
        eng_head = await _get_or_create_employee(db, "head.eng@assetflow.com", "Diya Head", roles["DEPT_HEAD"], engineering.department_id, "+12222222221")
        await _get_or_create_employee(db, "head.hr@assetflow.com", "Hardik Head", roles["DEPT_HEAD"], hr.department_id, "+12222222222")
        await _get_or_create_employee(db, "priya@assetflow.com", "Priya Sharma", roles["EMPLOYEE"], backend.department_id, "+13333333331")
        await _get_or_create_employee(db, "ankit@assetflow.com", "Ankit Verma", roles["EMPLOYEE"], frontend.department_id, "+13333333332")
        await _get_or_create_employee(db, "sara@assetflow.com", "Sara Khan", roles["EMPLOYEE"], finance.department_id, "+13333333333")
        await _get_or_create_employee(db, "rohan@assetflow.com", "Rohan Das", roles["EMPLOYEE"], ops.department_id, "+13333333334")

        # Set Engineering department head.
        eng = (await db.execute(select(Department).where(Department.department_id == engineering.department_id))).scalar_one()
        eng.head_employee_id = eng_head.employee_id

        # --- Assets ---
        await _get_or_create_asset(db, "Dell XPS 13", "SN-LAP-0001", laptops.category_id, floor1.location_id, backend.department_id, False, "GOOD", "125000.00")
        await _get_or_create_asset(db, "MacBook Pro 14", "SN-LAP-0002", laptops.category_id, floor1.location_id, frontend.department_id, False, "NEW", "210000.00")
        await _get_or_create_asset(db, "ThinkPad X1", "SN-LAP-0003", laptops.category_id, floor2.location_id, it_dept.department_id, False, "GOOD", "140000.00")
        await _get_or_create_asset(db, "LG UltraFine 27", "SN-MON-0001", monitors.category_id, floor1.location_id, backend.department_id, False, "GOOD", "45000.00")
        await _get_or_create_asset(db, "Dell U2723", "SN-MON-0002", monitors.category_id, floor2.location_id, frontend.department_id, False, "FAIR", "38000.00")
        await _get_or_create_asset(db, "Conference Room B2", "SN-ROOM-B2", rooms.category_id, floor2.location_id, None, True, "GOOD", "0.00")
        await _get_or_create_asset(db, "Boardroom A1", "SN-ROOM-A1", rooms.category_id, floor1.location_id, None, True, "GOOD", "0.00")
        await _get_or_create_asset(db, "Toyota Innova", "SN-VEH-0001", vehicles.category_id, warehouse.location_id, ops.department_id, True, "GOOD", "1800000.00")
        await _get_or_create_asset(db, "Ergonomic Chair", "SN-FUR-0001", furniture.category_id, floor1.location_id, hr.department_id, False, "GOOD", "22000.00")

        await db.commit()

    print("Seed complete.")
    print("  Demo users (password: password123):")
    print("    manager1@assetflow.com  (ASSET_MANAGER)")
    print("    head.eng@assetflow.com  (DEPT_HEAD, Engineering)")
    print("    priya@assetflow.com     (EMPLOYEE, Backend)")
    print("  ...plus departments, locations, 5 categories, and 9 assets.")


if __name__ == "__main__":
    asyncio.run(seed())
