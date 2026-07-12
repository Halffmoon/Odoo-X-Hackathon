import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

CONDITIONS = "^(NEW|GOOD|FAIR|POOR|DAMAGED)$"


class AllocationCreate(BaseModel):
    asset_id: uuid.UUID
    employee_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    expected_return_date: date | None = None

    @model_validator(mode="after")
    def _target_required(self):
        if self.employee_id is None and self.department_id is None:
            raise ValueError("Provide employee_id or department_id.")
        return self


class ReturnRequest(BaseModel):
    return_condition: str = Field(pattern=CONDITIONS)
    return_notes: str | None = None


class AllocationResponse(BaseModel):
    allocation_id: uuid.UUID
    asset_id: uuid.UUID
    asset_tag: str | None
    asset_name: str | None
    employee_id: uuid.UUID | None
    employee_name: str | None
    department_id: uuid.UUID | None
    department_name: str | None
    allocation_date: date
    expected_return_date: date | None
    actual_return_date: date | None
    return_condition: str | None
    return_notes: str | None
    status: str
    days_overdue: int | None = None


class OverdueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    allocation_id: uuid.UUID
    asset_id: uuid.UUID
    asset_tag: str
    asset_name: str
    employee_id: uuid.UUID | None
    department_id: uuid.UUID | None
    expected_return_date: date
    days_overdue: int


class AllocationHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    history_id: uuid.UUID
    allocation_id: uuid.UUID
    action: str
    performed_by: uuid.UUID | None
    performed_on: datetime
    details: dict | None
