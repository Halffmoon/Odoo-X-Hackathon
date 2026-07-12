import uuid
from datetime import datetime

from pydantic import BaseModel


class TransferCreate(BaseModel):
    asset_id: uuid.UUID
    to_employee_id: uuid.UUID
    remarks: str | None = None


class TransferActionRequest(BaseModel):
    remarks: str | None = None


class TransferResponse(BaseModel):
    transfer_id: uuid.UUID
    asset_id: uuid.UUID
    asset_tag: str | None
    from_employee_id: uuid.UUID | None
    from_employee_name: str | None
    to_employee_id: uuid.UUID
    to_employee_name: str | None
    requested_by: uuid.UUID
    approved_by: uuid.UUID | None
    status: str
    requested_on: datetime
    approved_on: datetime | None
    completed_on: datetime | None
    remarks: str | None
