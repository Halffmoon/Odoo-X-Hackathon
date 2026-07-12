import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

FINDINGS = "^(VERIFIED|MISSING|DAMAGED)$"


class AuditCycleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    department_id: uuid.UUID | None = None
    location_id: uuid.UUID | None = None
    start_date: date
    end_date: date
    auditor_employee_ids: list[uuid.UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def _check(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date.")
        if self.department_id is None and self.location_id is None:
            raise ValueError("Provide a department_id or location_id scope.")
        return self


class AuditProgress(BaseModel):
    total_in_scope: int
    verified: int
    missing: int
    damaged: int
    recorded: int


class AuditCycleResponse(BaseModel):
    audit_cycle_id: uuid.UUID
    name: str
    department_id: uuid.UUID | None
    location_id: uuid.UUID | None
    start_date: date
    end_date: date
    status: str
    closed_by: uuid.UUID | None
    closed_on: datetime | None
    created_on: datetime
    progress: AuditProgress
    auditor_employee_ids: list[uuid.UUID]


class AuditResultCreate(BaseModel):
    asset_id: uuid.UUID
    finding: str = Field(pattern=FINDINGS)
    remarks: str | None = None


class AuditResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    audit_result_id: uuid.UUID
    audit_cycle_id: uuid.UUID
    asset_id: uuid.UUID
    auditor_employee_id: uuid.UUID
    finding: str
    remarks: str | None
    recorded_on: datetime


class AuditorRequest(BaseModel):
    auditor_employee_id: uuid.UUID


class AuditAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    audit_assignment_id: uuid.UUID
    audit_cycle_id: uuid.UUID
    auditor_employee_id: uuid.UUID
    assigned_on: datetime


class DiscrepancyResponse(BaseModel):
    discrepancy_id: uuid.UUID
    audit_result_id: uuid.UUID
    audit_cycle_id: uuid.UUID
    asset_id: uuid.UUID
    asset_tag: str | None
    finding: str
    status: str
    resolved_by: uuid.UUID | None
    resolved_on: datetime | None
    resolution_notes: str | None


class ResolveDiscrepancyRequest(BaseModel):
    resolution_notes: str | None = None
