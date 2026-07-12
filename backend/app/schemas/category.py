import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    status: str | None = Field(default=None, pattern="^(ACTIVE|INACTIVE)$")


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category_id: uuid.UUID
    name: str
    description: str | None
    status: str
    created_on: datetime
    updated_on: datetime


class CustomFieldCreate(BaseModel):
    field_name: str = Field(min_length=1, max_length=100)
    field_type: str = Field(pattern="^(TEXT|NUMBER|DATE|BOOLEAN)$")
    is_required: bool = False


class CustomFieldUpdate(BaseModel):
    field_name: str | None = Field(default=None, min_length=1, max_length=100)
    field_type: str | None = Field(default=None, pattern="^(TEXT|NUMBER|DATE|BOOLEAN)$")
    is_required: bool | None = None


class CustomFieldResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    field_id: uuid.UUID
    category_id: uuid.UUID
    field_name: str
    field_type: str
    is_required: bool
