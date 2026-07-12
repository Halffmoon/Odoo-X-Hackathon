import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class UpcomingReturn(BaseModel):
    allocation_id: uuid.UUID
    asset_id: uuid.UUID
    asset_tag: str
    asset_name: str
    employee_id: uuid.UUID | None
    expected_return_date: date
    days_until_due: int


class DashboardKPIs(BaseModel):
    scope: str  # GLOBAL | DEPARTMENT | SELF
    assets_available: int
    assets_allocated: int
    maintenance_today: int
    active_bookings: int
    pending_transfers: int
    overdue_returns: int
    upcoming_returns: list[UpcomingReturn]


# ---------------- Reports ----------------

class UtilizationRow(BaseModel):
    asset_id: uuid.UUID
    asset_tag: str
    asset_name: str
    allocation_count: int
    total_allocation_days: int


class MaintenanceFrequencyRow(BaseModel):
    asset_id: uuid.UUID
    asset_tag: str
    category_id: uuid.UUID | None
    category_name: str | None
    request_count: int
    avg_resolution_hours: float | None


class DepartmentSummaryRow(BaseModel):
    department_id: uuid.UUID | None
    department_name: str | None
    total_assets: int
    allocated: int
    available: int
    under_maintenance: int


class BookingHeatmap(BaseModel):
    # matrix[dow][hour] = count; dow 0=Sunday..6=Saturday, hour 0..23
    matrix: list[list[int]]


class RetirementForecastRow(BaseModel):
    asset_id: uuid.UUID
    asset_tag: str
    asset_name: str
    condition: str
    acquisition_date: date | None
    reason: str


# ---------------- Notifications ----------------

class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notification_id: uuid.UUID
    recipient_employee_id: uuid.UUID
    type: str
    title: str
    message: str
    reference_table: str | None
    reference_id: uuid.UUID | None
    is_read: bool
    created_on: datetime


class NotificationList(BaseModel):
    unread_count: int
    total: int
    items: list[NotificationResponse]


# ---------------- Activity logs ----------------

class ActivityLogResponse(BaseModel):
    log_id: uuid.UUID
    actor_user_id: uuid.UUID | None
    actor_name: str | None
    action: str
    entity_table: str | None
    entity_id: uuid.UUID | None
    old_value: dict | None
    new_value: dict | None
    ip_address: str | None
    created_on: datetime
