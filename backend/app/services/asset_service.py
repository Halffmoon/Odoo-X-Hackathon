import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.allocation import AllocationHistory, AssetAllocation
from app.models.asset import (
    Asset,
    AssetAttachment,
    AssetCustomFieldValue,
    AssetStatusHistory,
)
from app.models.category import AssetCategory, CategoryCustomField
from app.models.department import Department
from app.models.employee import Employee
from app.models.location import Location
from app.models.maintenance import MaintenanceHistory, MaintenanceRequest
from app.schemas.asset import (
    AssetCreate,
    AssetHistoryEvent,
    AssetResponse,
    AssetUpdate,
    CustomFieldValueResponse,
)
from app.utils.activity_logger import log_activity
from app.utils.tag_generator import generate_next_tag

# Legal lifecycle transitions (Phase 3.2).
VALID_TRANSITIONS: dict[str, set[str]] = {
    "AVAILABLE": {"ALLOCATED", "RESERVED", "UNDER_MAINTENANCE", "RETIRED", "DISPOSED"},
    "ALLOCATED": {"AVAILABLE", "UNDER_MAINTENANCE", "LOST"},
    "RESERVED": {"AVAILABLE", "ALLOCATED"},
    "UNDER_MAINTENANCE": {"AVAILABLE"},
    "LOST": {"AVAILABLE", "DISPOSED"},
    "RETIRED": {"DISPOSED"},
    "DISPOSED": set(),
}


def _to_response(
    asset: Asset,
    category_name: str | None,
    location_name: str | None,
    department_name: str | None,
) -> AssetResponse:
    return AssetResponse(
        asset_id=asset.asset_id,
        asset_tag=asset.asset_tag,
        name=asset.name,
        category_id=asset.category_id,
        category_name=category_name,
        serial_number=asset.serial_number,
        acquisition_date=asset.acquisition_date,
        acquisition_cost=asset.acquisition_cost,
        condition=asset.condition,
        location_id=asset.location_id,
        location_name=location_name,
        current_department_id=asset.current_department_id,
        department_name=department_name,
        is_bookable=asset.is_bookable,
        status=asset.status,
        qr_code=asset.qr_code,
        created_on=asset.created_on,
        updated_on=asset.updated_on,
    )


async def _get_or_404(db: AsyncSession, asset_id: uuid.UUID) -> Asset:
    result = await db.execute(
        select(Asset).where(Asset.asset_id == asset_id, Asset.is_deleted.is_(False))
    )
    asset = result.scalar_one_or_none()
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found.")
    return asset


async def _hydrate(db: AsyncSession, asset: Asset) -> AssetResponse:
    category_name = (
        await db.execute(
            select(AssetCategory.name).where(
                AssetCategory.category_id == asset.category_id
            )
        )
    ).scalar_one_or_none()
    location_name = None
    if asset.location_id:
        location_name = (
            await db.execute(
                select(Location.name).where(Location.location_id == asset.location_id)
            )
        ).scalar_one_or_none()
    department_name = None
    if asset.current_department_id:
        department_name = (
            await db.execute(
                select(Department.name).where(
                    Department.department_id == asset.current_department_id
                )
            )
        ).scalar_one_or_none()
    return _to_response(asset, category_name, location_name, department_name)


async def register_asset(
    db: AsyncSession, data: AssetCreate, actor: Employee, ip: str | None
) -> AssetResponse:
    tag = await generate_next_tag(db, Asset, "asset_tag", "AF")
    asset = Asset(
        asset_tag=tag,
        name=data.name,
        category_id=data.category_id,
        serial_number=data.serial_number,
        acquisition_date=data.acquisition_date,
        acquisition_cost=data.acquisition_cost,
        condition=data.condition,
        location_id=data.location_id,
        current_department_id=data.current_department_id,
        is_bookable=data.is_bookable,
        qr_code=data.qr_code,
        created_by=actor.user_id,
        updated_by=actor.user_id,
    )
    db.add(asset)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Duplicate serial number or invalid category/location/department.",
        )

    db.add(
        AssetStatusHistory(
            asset_id=asset.asset_id,
            old_status=None,
            new_status="AVAILABLE",
            changed_by=actor.employee_id,
            reason="Asset registered",
        )
    )
    await log_activity(
        db, actor.user_id, "REGISTER_ASSET", "assets", asset.asset_id,
        new_value={"asset_tag": tag, "name": asset.name}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(asset)
    return await _hydrate(db, asset)


async def search_assets(
    db: AsyncSession,
    *,
    q: str | None = None,
    serial_number: str | None = None,
    category_id: uuid.UUID | None = None,
    status: str | None = None,
    department_id: uuid.UUID | None = None,
    location_id: uuid.UUID | None = None,
    qr_code: str | None = None,
    is_bookable: bool | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AssetResponse], int]:
    filters = [Asset.is_deleted.is_(False)]
    if q:
        like = f"%{q}%"
        filters.append(Asset.asset_tag.ilike(like) | Asset.name.ilike(like))
    if serial_number:
        filters.append(Asset.serial_number.ilike(f"%{serial_number}%"))
    if category_id:
        filters.append(Asset.category_id == category_id)
    if status:
        filters.append(Asset.status == status)
    if department_id:
        filters.append(Asset.current_department_id == department_id)
    if location_id:
        filters.append(Asset.location_id == location_id)
    if qr_code:
        filters.append(Asset.qr_code == qr_code)
    if is_bookable is not None:
        filters.append(Asset.is_bookable.is_(is_bookable))

    total = (
        await db.execute(select(func.count()).select_from(Asset).where(*filters))
    ).scalar_one()

    stmt = (
        select(Asset, AssetCategory.name, Location.name, Department.name)
        .join(AssetCategory, AssetCategory.category_id == Asset.category_id)
        .join(Location, Location.location_id == Asset.location_id, isouter=True)
        .join(
            Department,
            Department.department_id == Asset.current_department_id,
            isouter=True,
        )
        .where(*filters)
        .order_by(Asset.asset_tag)
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).all()
    return [_to_response(a, cn, ln, dn) for a, cn, ln, dn in rows], total


async def get_asset(db: AsyncSession, asset_id: uuid.UUID) -> AssetResponse:
    asset = await _get_or_404(db, asset_id)
    return await _hydrate(db, asset)


async def update_asset(
    db: AsyncSession,
    asset_id: uuid.UUID,
    data: AssetUpdate,
    actor: Employee,
    ip: str | None,
) -> AssetResponse:
    asset = await _get_or_404(db, asset_id)
    fields = (
        "name", "category_id", "serial_number", "acquisition_date",
        "acquisition_cost", "condition", "location_id",
        "current_department_id", "is_bookable", "qr_code",
    )
    for field in fields:
        value = getattr(data, field)
        if value is not None:
            setattr(asset, field, value)
    asset.updated_by = actor.user_id
    asset.updated_on = datetime.now(timezone.utc)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="Duplicate serial number or invalid reference."
        )
    await log_activity(
        db, actor.user_id, "UPDATE_ASSET", "assets", asset.asset_id, ip_address=ip
    )
    await db.commit()
    await db.refresh(asset)
    return await _hydrate(db, asset)


async def delete_asset(
    db: AsyncSession, asset_id: uuid.UUID, actor: Employee, ip: str | None
) -> None:
    asset = await _get_or_404(db, asset_id)
    asset.is_deleted = True
    asset.updated_by = actor.user_id
    asset.updated_on = datetime.now(timezone.utc)
    await log_activity(
        db, actor.user_id, "DELETE_ASSET", "assets", asset.asset_id, ip_address=ip
    )
    await db.commit()


async def change_status(
    db: AsyncSession,
    asset_id: uuid.UUID,
    new_status: str,
    reason: str | None,
    actor: Employee,
    ip: str | None,
) -> AssetResponse:
    asset = await _get_or_404(db, asset_id)
    old_status = asset.status
    if new_status == old_status:
        raise HTTPException(status_code=400, detail="Asset already in that status.")
    allowed = VALID_TRANSITIONS.get(old_status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"Illegal transition {old_status} -> {new_status}. "
            f"Allowed: {sorted(allowed) or 'none'}.",
        )
    asset.status = new_status
    asset.updated_by = actor.user_id
    asset.updated_on = datetime.now(timezone.utc)
    db.add(
        AssetStatusHistory(
            asset_id=asset.asset_id,
            old_status=old_status,
            new_status=new_status,
            changed_by=actor.employee_id,
            reason=reason,
        )
    )
    await log_activity(
        db, actor.user_id, "CHANGE_ASSET_STATUS", "assets", asset.asset_id,
        old_value={"status": old_status}, new_value={"status": new_status},
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(asset)
    return await _hydrate(db, asset)


async def get_status_history(
    db: AsyncSession, asset_id: uuid.UUID
) -> list[AssetStatusHistory]:
    await _get_or_404(db, asset_id)
    result = await db.execute(
        select(AssetStatusHistory)
        .where(AssetStatusHistory.asset_id == asset_id)
        .order_by(AssetStatusHistory.changed_on.desc())
    )
    return list(result.scalars().all())


# ---------------- custom field values ----------------

async def get_field_values(
    db: AsyncSession, asset_id: uuid.UUID
) -> list[CustomFieldValueResponse]:
    asset = await _get_or_404(db, asset_id)
    # Join the category's field definitions with any stored values for this asset.
    fields = (
        await db.execute(
            select(CategoryCustomField)
            .where(CategoryCustomField.category_id == asset.category_id)
            .order_by(CategoryCustomField.field_name)
        )
    ).scalars().all()
    values = {
        v.field_id: v
        for v in (
            await db.execute(
                select(AssetCustomFieldValue).where(
                    AssetCustomFieldValue.asset_id == asset_id
                )
            )
        ).scalars().all()
    }
    out: list[CustomFieldValueResponse] = []
    for f in fields:
        v = values.get(f.field_id)
        value = None
        if v is not None:
            value = {
                "TEXT": v.text_value,
                "NUMBER": v.number_value,
                "DATE": v.date_value,
                "BOOLEAN": v.boolean_value,
            }.get(f.field_type)
        out.append(
            CustomFieldValueResponse(
                field_id=f.field_id,
                field_name=f.field_name,
                field_type=f.field_type,
                is_required=f.is_required,
                value=value,
            )
        )
    return out


def _coerce_value(field_type: str, raw):
    """Return a dict of the correct typed column -> value; others None."""
    cols = {
        "text_value": None,
        "number_value": None,
        "date_value": None,
        "boolean_value": None,
    }
    if raw is None:
        return cols
    try:
        if field_type == "TEXT":
            cols["text_value"] = str(raw)
        elif field_type == "NUMBER":
            cols["number_value"] = float(raw)
        elif field_type == "DATE":
            cols["date_value"] = raw if isinstance(raw, date) else date.fromisoformat(str(raw))
        elif field_type == "BOOLEAN":
            cols["boolean_value"] = raw if isinstance(raw, bool) else str(raw).lower() in ("true", "1", "yes")
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=422,
            detail=f"Value '{raw}' is not valid for a {field_type} field.",
        )
    return cols


async def upsert_field_values(
    db: AsyncSession,
    asset_id: uuid.UUID,
    items,
    actor: Employee,
    ip: str | None,
) -> list[CustomFieldValueResponse]:
    asset = await _get_or_404(db, asset_id)
    valid_fields = {
        f.field_id: f
        for f in (
            await db.execute(
                select(CategoryCustomField).where(
                    CategoryCustomField.category_id == asset.category_id
                )
            )
        ).scalars().all()
    }
    for item in items:
        field = valid_fields.get(item.field_id)
        if field is None:
            raise HTTPException(
                status_code=422,
                detail=f"Field {item.field_id} does not belong to this asset's category.",
            )
        cols = _coerce_value(field.field_type, item.value)
        existing = (
            await db.execute(
                select(AssetCustomFieldValue).where(
                    AssetCustomFieldValue.asset_id == asset_id,
                    AssetCustomFieldValue.field_id == item.field_id,
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            db.add(
                AssetCustomFieldValue(
                    asset_id=asset_id,
                    field_id=item.field_id,
                    updated_by=actor.user_id,
                    **cols,
                )
            )
        else:
            for k, val in cols.items():
                setattr(existing, k, val)
            existing.updated_by = actor.user_id
            existing.updated_on = datetime.now(timezone.utc)

    await log_activity(
        db, actor.user_id, "UPDATE_ASSET_FIELDS", "assets", asset_id, ip_address=ip
    )
    await db.commit()
    return await get_field_values(db, asset_id)


# ---------------- attachments ----------------

async def list_attachments(
    db: AsyncSession, asset_id: uuid.UUID
) -> list[AssetAttachment]:
    await _get_or_404(db, asset_id)
    result = await db.execute(
        select(AssetAttachment)
        .where(AssetAttachment.asset_id == asset_id)
        .order_by(AssetAttachment.uploaded_on.desc())
    )
    return list(result.scalars().all())


async def add_attachment(
    db: AsyncSession,
    asset_id: uuid.UUID,
    file_url: str,
    file_type: str,
    actor: Employee,
    ip: str | None,
) -> AssetAttachment:
    await _get_or_404(db, asset_id)
    attachment = AssetAttachment(
        asset_id=asset_id,
        maintenance_id=None,
        file_url=file_url,
        file_type=file_type,
        uploaded_by=actor.employee_id,
    )
    db.add(attachment)
    await log_activity(
        db, actor.user_id, "ADD_ATTACHMENT", "asset_attachments", None,
        new_value={"asset_id": str(asset_id), "file_url": file_url}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(attachment)
    return attachment


async def delete_attachment(
    db: AsyncSession, attachment_id: uuid.UUID, actor: Employee, ip: str | None
) -> None:
    attachment = (
        await db.execute(
            select(AssetAttachment).where(
                AssetAttachment.attachment_id == attachment_id
            )
        )
    ).scalar_one_or_none()
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found.")
    await db.delete(attachment)
    await log_activity(
        db, actor.user_id, "DELETE_ATTACHMENT", "asset_attachments", attachment_id,
        ip_address=ip,
    )
    await db.commit()


# ---------------- combined history ----------------

async def get_combined_history(
    db: AsyncSession, asset_id: uuid.UUID
) -> list[AssetHistoryEvent]:
    await _get_or_404(db, asset_id)

    alloc_rows = (
        await db.execute(
            select(AllocationHistory)
            .join(
                AssetAllocation,
                AssetAllocation.allocation_id == AllocationHistory.allocation_id,
            )
            .where(AssetAllocation.asset_id == asset_id)
        )
    ).scalars().all()

    maint_rows = (
        await db.execute(
            select(MaintenanceHistory)
            .join(
                MaintenanceRequest,
                MaintenanceRequest.maintenance_id == MaintenanceHistory.maintenance_id,
            )
            .where(MaintenanceRequest.asset_id == asset_id)
        )
    ).scalars().all()

    events: list[AssetHistoryEvent] = []
    for r in alloc_rows:
        events.append(
            AssetHistoryEvent(
                event_type="ALLOCATION",
                action=r.action,
                performed_on=r.performed_on,
                performed_by=r.performed_by,
                reference_id=r.allocation_id,
                details=r.details,
            )
        )
    for r in maint_rows:
        events.append(
            AssetHistoryEvent(
                event_type="MAINTENANCE",
                action=r.action,
                performed_on=r.performed_on,
                performed_by=r.performed_by,
                reference_id=r.maintenance_id,
            )
        )
    events.sort(key=lambda e: e.performed_on, reverse=True)
    return events
