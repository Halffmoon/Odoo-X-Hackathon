import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Asset(Base):
    __tablename__ = "assets"

    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    asset_tag: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset_categories.category_id"), nullable=False
    )
    serial_number: Mapped[str | None] = mapped_column(String(100), unique=True)
    acquisition_date: Mapped[date | None] = mapped_column(Date)
    acquisition_cost: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    condition: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'GOOD'")
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.location_id")
    )
    current_department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.department_id")
    )
    is_bookable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'AVAILABLE'")
    )
    qr_code: Mapped[str | None] = mapped_column(String(255))
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_on: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    updated_on: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )

    __table_args__ = (
        CheckConstraint(
            "condition IN ('NEW','GOOD','FAIR','POOR','DAMAGED')",
            name="ck_assets_condition",
        ),
        CheckConstraint(
            "status IN ('AVAILABLE','ALLOCATED','RESERVED','UNDER_MAINTENANCE',"
            "'LOST','RETIRED','DISPOSED')",
            name="ck_assets_status",
        ),
    )


class AssetCustomFieldValue(Base):
    __tablename__ = "asset_custom_field_values"

    value_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.asset_id"), nullable=False
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("category_custom_fields.field_id"),
        nullable=False,
    )
    text_value: Mapped[str | None] = mapped_column(Text)
    number_value: Mapped[Decimal | None] = mapped_column(Numeric(18, 4))
    date_value: Mapped[date | None] = mapped_column(Date)
    boolean_value: Mapped[bool | None] = mapped_column(Boolean)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    updated_on: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    __table_args__ = (
        UniqueConstraint("asset_id", "field_id", name="uq_acfv_asset_field"),
    )


class AssetAttachment(Base):
    __tablename__ = "asset_attachments"

    attachment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.asset_id")
    )
    # FK to maintenance_requests added at DB level (deferred) — see migration.
    maintenance_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.employee_id")
    )
    uploaded_on: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    __table_args__ = (
        CheckConstraint(
            "file_type IN ('PHOTO','DOCUMENT')", name="ck_attachment_file_type"
        ),
        CheckConstraint(
            "(asset_id IS NOT NULL AND maintenance_id IS NULL) OR "
            "(asset_id IS NULL AND maintenance_id IS NOT NULL)",
            name="ck_attachment_polymorphic",
        ),
    )


class AssetStatusHistory(Base):
    __tablename__ = "asset_status_history"

    status_history_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.asset_id"), nullable=False
    )
    old_status: Mapped[str | None] = mapped_column(String(20))
    new_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.employee_id")
    )
    changed_on: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    reason: Mapped[str | None] = mapped_column(Text)
