import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EmployeeResponse(BaseModel):
    employee_id: uuid.UUID
    user_id: uuid.UUID
    employee_code: str
    name: str
    email: EmailStr
    phone: str | None
    role_id: int
    role_code: str
    department_id: uuid.UUID | None
    department_name: str | None
    status: str
    created_on: datetime


class EmployeeUpdate(BaseModel):
    # Admin may set any of these; a self-update is limited to name + phone.
    name: str | None = Field(default=None, min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    department_id: uuid.UUID | None = None
    status: str | None = Field(default=None, pattern="^(ACTIVE|INACTIVE)$")


class PromoteRequest(BaseModel):
    new_role_code: str = Field(pattern="^(ADMIN|ASSET_MANAGER|DEPT_HEAD|EMPLOYEE)$")


class RoleHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role_history_id: uuid.UUID
    employee_id: uuid.UUID
    old_role_id: int | None
    new_role_id: int
    changed_by: uuid.UUID
    changed_on: datetime


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role_id: int
    role_code: str
