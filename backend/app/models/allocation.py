import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AssetAllocation(Base):
    __tablename__ = "asset_allocations"

    allocation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.asset_id"), nullable=False
    )
    employee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.employee_id")
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.department_id")
    )
    allocation_date: Mapped[date] = mapped_column(
        Date, nullable=False, server_default=text("current_date")
    )
    expected_return_date: Mapped[date | None] = mapped_column(Date)
    actual_return_date: Mapped[date | None] = mapped_column(Date)
    return_condition: Mapped[str | None] = mapped_column(String(20))
    return_notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'ACTIVE'")
    )
    allocated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.employee_id")
    )
    created_on: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_on: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    __table_args__ = (
        CheckConstraint(
            "return_condition IN ('NEW','GOOD','FAIR','POOR','DAMAGED')",
            name="ck_alloc_return_condition",
        ),
        CheckConstraint("status IN ('ACTIVE','RETURNED')", name="ck_alloc_status"),
        CheckConstraint(
            "expected_return_date IS NULL OR expected_return_date >= allocation_date",
            name="ck_alloc_expected_return",
        ),
        CheckConstraint(
            "actual_return_date IS NULL OR actual_return_date >= allocation_date",
            name="ck_alloc_actual_return",
        ),
        CheckConstraint(
            "employee_id IS NOT NULL OR department_id IS NOT NULL",
            name="ck_alloc_target",
        ),
    )


class AllocationHistory(Base):
    __tablename__ = "allocation_history"

    history_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    allocation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("asset_allocations.allocation_id"),
        nullable=False,
    )
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    performed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.employee_id")
    )
    performed_on: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    details: Mapped[dict | None] = mapped_column(JSONB)
