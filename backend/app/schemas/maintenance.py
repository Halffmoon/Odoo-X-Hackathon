import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

PRIORITIES = "^(LOW|MEDIUM|HIGH|CRITICAL)$"


class MaintenanceCreate(BaseModel):
    asset_id: uuid.UUID
    issue_description: str = Field(min_length=1)
    priority: str = Field(default="MEDIUM", pattern=PRIORITIES)


class AssignTechnicianRequest(BaseModel):
    technician_id: uuid.UUID


class ResolveRequest(BaseModel):
    resolution_notes: str | None = None


class RejectRequest(BaseModel):
    reason: str | None = None


class MaintenanceResponse(BaseModel):
    maintenance_id: uuid.UUID
    asset_id: uuid.UUID
    asset_tag: str | None
    asset_name: str | None
    requested_by: uuid.UUID
    requester_name: str | None
    issue_description: str
    priority: str
    status: str
    approved_by: uuid.UUID | None
    approved_on: datetime | None
    technician_id: uuid.UUID | None
    technician_name: str | None
    resolved_on: datetime | None
    resolution_notes: str | None
    created_on: datetime
    updated_on: datetime


class MaintenanceHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    history_id: uuid.UUID
    maintenance_id: uuid.UUID
    action: str
    performed_by: uuid.UUID | None
    performed_on: datetime
