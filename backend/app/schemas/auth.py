import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=20)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class EmployeeInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    employee_id: uuid.UUID
    user_id: uuid.UUID
    employee_code: str
    name: str
    email: EmailStr
    role_code: str
    department_id: uuid.UUID | None = None
    phone: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    employee: EmployeeInfo


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    # In production the raw token is emailed, not returned. Exposed here for dev/testing.
    message: str
    reset_token: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str
