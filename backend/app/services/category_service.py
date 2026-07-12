import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.category import AssetCategory, CategoryCustomField
from app.models.employee import Employee
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CustomFieldCreate,
    CustomFieldUpdate,
)
from app.utils.activity_logger import log_activity


async def _get_category_or_404(
    db: AsyncSession, category_id: uuid.UUID
) -> AssetCategory:
    result = await db.execute(
        select(AssetCategory).where(
            AssetCategory.category_id == category_id,
            AssetCategory.is_deleted.is_(False),
        )
    )
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(status_code=404, detail="Category not found.")
    return cat


async def list_categories(
    db: AsyncSession, include_inactive: bool = False
) -> list[AssetCategory]:
    stmt = select(AssetCategory).where(AssetCategory.is_deleted.is_(False))
    if not include_inactive:
        stmt = stmt.where(AssetCategory.status == "ACTIVE")
    result = await db.execute(stmt.order_by(AssetCategory.name))
    return list(result.scalars().all())


async def get_category(db: AsyncSession, category_id: uuid.UUID) -> AssetCategory:
    return await _get_category_or_404(db, category_id)


async def create_category(
    db: AsyncSession, data: CategoryCreate, actor: Employee, ip: str | None
) -> AssetCategory:
    cat = AssetCategory(
        name=data.name,
        description=data.description,
        created_by=actor.user_id,
        updated_by=actor.user_id,
    )
    db.add(cat)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Category name already exists.")
    await log_activity(
        db, actor.user_id, "CREATE_CATEGORY", "asset_categories", cat.category_id,
        new_value={"name": cat.name}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(cat)
    return cat


async def update_category(
    db: AsyncSession,
    category_id: uuid.UUID,
    data: CategoryUpdate,
    actor: Employee,
    ip: str | None,
) -> AssetCategory:
    cat = await _get_category_or_404(db, category_id)
    old = {"name": cat.name, "status": cat.status}
    for field in ("name", "description", "status"):
        value = getattr(data, field)
        if value is not None:
            setattr(cat, field, value)
    cat.updated_by = actor.user_id
    cat.updated_on = datetime.now(timezone.utc)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Category name already exists.")
    await log_activity(
        db, actor.user_id, "UPDATE_CATEGORY", "asset_categories", cat.category_id,
        old_value=old, new_value={"name": cat.name, "status": cat.status}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(cat)
    return cat


async def delete_category(
    db: AsyncSession, category_id: uuid.UUID, actor: Employee, ip: str | None
) -> None:
    cat = await _get_category_or_404(db, category_id)
    asset_count = (
        await db.execute(
            select(func.count())
            .select_from(Asset)
            .where(Asset.category_id == category_id, Asset.is_deleted.is_(False))
        )
    ).scalar_one()
    if asset_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {asset_count} asset(s) use this category.",
        )
    cat.is_deleted = True
    cat.status = "INACTIVE"
    cat.updated_by = actor.user_id
    cat.updated_on = datetime.now(timezone.utc)
    await log_activity(
        db, actor.user_id, "DELETE_CATEGORY", "asset_categories", cat.category_id,
        ip_address=ip,
    )
    await db.commit()


# ---------------- Custom fields ----------------

async def list_fields(
    db: AsyncSession, category_id: uuid.UUID
) -> list[CategoryCustomField]:
    await _get_category_or_404(db, category_id)
    result = await db.execute(
        select(CategoryCustomField)
        .where(CategoryCustomField.category_id == category_id)
        .order_by(CategoryCustomField.field_name)
    )
    return list(result.scalars().all())


async def _get_field_or_404(
    db: AsyncSession, category_id: uuid.UUID, field_id: uuid.UUID
) -> CategoryCustomField:
    result = await db.execute(
        select(CategoryCustomField).where(
            CategoryCustomField.field_id == field_id,
            CategoryCustomField.category_id == category_id,
        )
    )
    field = result.scalar_one_or_none()
    if field is None:
        raise HTTPException(status_code=404, detail="Custom field not found.")
    return field


async def create_field(
    db: AsyncSession,
    category_id: uuid.UUID,
    data: CustomFieldCreate,
    actor: Employee,
    ip: str | None,
) -> CategoryCustomField:
    await _get_category_or_404(db, category_id)
    field = CategoryCustomField(
        category_id=category_id,
        field_name=data.field_name,
        field_type=data.field_type,
        is_required=data.is_required,
    )
    db.add(field)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A field with this name already exists on the category.",
        )
    await log_activity(
        db, actor.user_id, "CREATE_CUSTOM_FIELD", "category_custom_fields",
        field.field_id, new_value={"field_name": field.field_name}, ip_address=ip,
    )
    await db.commit()
    await db.refresh(field)
    return field


async def update_field(
    db: AsyncSession,
    category_id: uuid.UUID,
    field_id: uuid.UUID,
    data: CustomFieldUpdate,
    actor: Employee,
    ip: str | None,
) -> CategoryCustomField:
    field = await _get_field_or_404(db, category_id, field_id)
    for name in ("field_name", "field_type", "is_required"):
        value = getattr(data, name)
        if value is not None:
            setattr(field, name, value)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A field with this name already exists on the category.",
        )
    await log_activity(
        db, actor.user_id, "UPDATE_CUSTOM_FIELD", "category_custom_fields",
        field.field_id, ip_address=ip,
    )
    await db.commit()
    await db.refresh(field)
    return field


async def delete_field(
    db: AsyncSession,
    category_id: uuid.UUID,
    field_id: uuid.UUID,
    actor: Employee,
    ip: str | None,
) -> None:
    field = await _get_field_or_404(db, category_id, field_id)
    await db.delete(field)
    await log_activity(
        db, actor.user_id, "DELETE_CUSTOM_FIELD", "category_custom_fields",
        field_id, ip_address=ip,
    )
    await db.commit()
