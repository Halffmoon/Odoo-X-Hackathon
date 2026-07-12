import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LocationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    address: str | None = None


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    address: str | None = None
    status: str | None = Field(default=None, pattern="^(ACTIVE|INACTIVE)$")


class LocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    location_id: uuid.UUID
    name: str
    address: str | None
    status: str
    created_on: datetime
    updated_on: datetime
