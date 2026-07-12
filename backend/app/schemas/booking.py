import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, model_validator


class BookingCreate(BaseModel):
    asset_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    purpose: str | None = None

    @model_validator(mode="after")
    def _check_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class BookingReschedule(BaseModel):
    start_time: datetime
    end_time: datetime

    @model_validator(mode="after")
    def _check_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class BookingResponse(BaseModel):
    booking_id: uuid.UUID
    asset_id: uuid.UUID
    asset_name: str | None
    employee_id: uuid.UUID
    employee_name: str | None
    department_id: uuid.UUID | None
    department_name: str | None
    start_time: datetime
    end_time: datetime
    status: str
    purpose: str | None


class TimeSlot(BaseModel):
    start: datetime
    end: datetime
    booked_by: str | None = None
    booking_id: uuid.UUID | None = None


class AvailabilityResponse(BaseModel):
    asset_id: uuid.UUID
    date: date
    booked_slots: list[TimeSlot]
    free_slots: list[TimeSlot]


class BookingHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    history_id: uuid.UUID
    booking_id: uuid.UUID
    action: str
    performed_by: uuid.UUID | None
    performed_on: datetime
