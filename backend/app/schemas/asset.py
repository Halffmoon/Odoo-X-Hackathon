import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

CONDITIONS = "^(NEW|GOOD|FAIR|POOR|DAMAGED)$"
STATUSES = "^(AVAILABLE|ALLOCATED|RESERVED|UNDER_MAINTENANCE|LOST|RETIRED|DISPOSED)$"


class AssetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    category_id: uuid.UUID
    serial_number: str | None = Field(default=None, max_length=100)
    acquisition_date: date | None = None
    acquisition_cost: Decimal | None = None
    condition: str = Field(default="GOOD", pattern=CONDITIONS)
    location_id: uuid.UUID | None = None
    current_department_id: uuid.UUID | None = None
    is_bookable: bool = False
    qr_code: str | None = Field(default=None, max_length=255)


class AssetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    category_id: uuid.UUID | None = None
    serial_number: str | None = Field(default=None, max_length=100)
    acquisition_date: date | None = None
    acquisition_cost: Decimal | None = None
    condition: str | None = Field(default=None, pattern=CONDITIONS)
    location_id: uuid.UUID | None = None
    current_department_id: uuid.UUID | None = None
    is_bookable: bool | None = None
    qr_code: str | None = Field(default=None, max_length=255)


class AssetResponse(BaseModel):
    asset_id: uuid.UUID
    asset_tag: str
    name: str
    category_id: uuid.UUID
    category_name: str | None
    serial_number: str | None
    acquisition_date: date | None
    acquisition_cost: Decimal | None
    condition: str
    location_id: uuid.UUID | None
    location_name: str | None
    current_department_id: uuid.UUID | None
    department_name: str | None
    is_bookable: bool
    status: str
    qr_code: str | None
    created_on: datetime
    updated_on: datetime


class AssetStatusUpdate(BaseModel):
    new_status: str = Field(pattern=STATUSES)
    reason: str | None = None


class AssetStatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status_history_id: uuid.UUID
    asset_id: uuid.UUID
    old_status: str | None
    new_status: str
    changed_by: uuid.UUID | None
    changed_on: datetime
    reason: str | None


class CustomFieldValueItem(BaseModel):
    field_id: uuid.UUID
    value: str | float | bool | date | None = None


class CustomFieldValuesUpdate(BaseModel):
    values: list[CustomFieldValueItem]


class CustomFieldValueResponse(BaseModel):
    field_id: uuid.UUID
    field_name: str
    field_type: str
    is_required: bool
    value: str | float | bool | date | None = None


class AttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    attachment_id: uuid.UUID
    asset_id: uuid.UUID | None
    maintenance_id: uuid.UUID | None
    file_url: str
    file_type: str
    uploaded_by: uuid.UUID | None
    uploaded_on: datetime


class AssetHistoryEvent(BaseModel):
    event_type: str  # ALLOCATION | MAINTENANCE
    action: str
    performed_on: datetime
    performed_by: uuid.UUID | None
    reference_id: uuid.UUID
    details: dict | None = None
