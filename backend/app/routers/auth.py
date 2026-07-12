from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshTokenRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _device_info(request: Request) -> str | None:
    ua = request.headers.get("user-agent")
    return ua[:255] if ua else None


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    data: SignupRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.signup(db, data, _device_info(request))


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.login(
        db, data.email, data.password, _device_info(request)
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    data: RefreshTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.refresh(db, data.refresh_token, _device_info(request))


@router.post("/logout", response_model=MessageResponse)
async def logout(data: LogoutRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.logout(db, data.refresh_token)
    return MessageResponse(message="Logged out.")


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
):
    raw_token = await auth_service.forgot_password(db, data.email)
    return ForgotPasswordResponse(
        message="If an account exists for this email, a reset token has been issued.",
        reset_token=raw_token,
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    await auth_service.reset_password(db, data.token, data.new_password)
    return MessageResponse(message="Password has been reset.")
