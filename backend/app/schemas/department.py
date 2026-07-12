import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    parent_department_id: uuid.UUID | None = None
    head_employee_id: uuid.UUID | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    parent_department_id: uuid.UUID | None = None
    head_employee_id: uuid.UUID | None = None
    status: str | None = Field(default=None, pattern="^(ACTIVE|INACTIVE)$")


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    department_id: uuid.UUID
    name: str
    parent_department_id: uuid.UUID | None
    head_employee_id: uuid.UUID | None
    status: str
    created_on: datetime
    updated_on: datetime


class DepartmentTreeNode(BaseModel):
    department_id: uuid.UUID
    name: str
    parent_department_id: uuid.UUID | None
    status: str
    children: list["DepartmentTreeNode"] = []
