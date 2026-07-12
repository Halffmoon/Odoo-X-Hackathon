import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.config import settings
from app.models.employee import Employee, Role
from app.models.user import PasswordResetToken, RefreshToken, User
from app.schemas.auth import EmployeeInfo, TokenResponse
from app.utils.activity_logger import log_activity
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.utils.tag_generator import generate_next_tag

EMPLOYEE_ROLE_CODE = "EMPLOYEE"


async def _role_id_by_code(db: AsyncSession, role_code: str) -> int:
    result = await db.execute(select(Role).where(Role.role_code == role_code))
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Role {role_code} is not seeded.",
        )
    return role.role_id


async def _build_employee_info(
    db: AsyncSession, employee: Employee, email: str
) -> EmployeeInfo:
    return EmployeeInfo(
        employee_id=employee.employee_id,
        user_id=employee.user_id,
        employee_code=employee.employee_code,
        name=employee.name,
        email=email,
        role_code=employee.role.role_code,
        department_id=employee.department_id,
        phone=employee.phone,
    )


async def _issue_tokens(
    db: AsyncSession,
    user: User,
    employee: Employee,
    device_info: str | None = None,
) -> TokenResponse:
    claims = {
        "sub": str(user.user_id),
        "employee_id": str(employee.employee_id),
        "role": employee.role.role_code,
    }
    access_token = create_access_token(claims)
    refresh_token = create_refresh_token(claims)

    db.add(
        RefreshToken(
            user_id=user.user_id,
            token_hash=hash_token(refresh_token),
            device_info=device_info,
            expires_on=datetime.now(timezone.utc)
            + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )

    info = await _build_employee_info(db, employee, user.email)
    return TokenResponse(
        access_token=access_token, refresh_token=refresh_token, employee=info
    )


async def signup(
    db: AsyncSession, data, device_info: str | None = None
) -> TokenResponse:
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    role_id = await _role_id_by_code(db, EMPLOYEE_ROLE_CODE)

    user = User(email=data.email, password_hash=hash_password(data.password))
    db.add(user)
    await db.flush()  # populate user_id

    employee_code = await generate_next_tag(db, Employee, "employee_code", "EMP")
    employee = Employee(
        user_id=user.user_id,
        employee_code=employee_code,
        name=data.name,
        phone=data.phone,
        role_id=role_id,
    )
    db.add(employee)

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Load role relationship for token/response.
    await db.refresh(employee, attribute_names=["role"])

    tokens = await _issue_tokens(db, user, employee, device_info)
    await log_activity(
        db,
        actor_user_id=user.user_id,
        action="SIGNUP",
        entity_table="users",
        entity_id=user.user_id,
        new_value={"email": data.email, "employee_code": employee_code},
    )
    await db.commit()
    return tokens


async def login(
    db: AsyncSession, email: str, password: str, device_info: str | None = None
) -> TokenResponse:
    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status.lower()}.",
        )

    emp_result = await db.execute(
        select(Employee)
        .options(joinedload(Employee.role))
        .where(Employee.user_id == user.user_id)
    )
    employee = emp_result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No employee profile linked to this account.",
        )

    user.last_login_on = datetime.now(timezone.utc)
    tokens = await _issue_tokens(db, user, employee, device_info)
    await log_activity(
        db,
        actor_user_id=user.user_id,
        action="LOGIN",
        entity_table="users",
        entity_id=user.user_id,
    )
    await db.commit()
    return tokens


async def refresh(
    db: AsyncSession, refresh_token: str, device_info: str | None = None
) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not a refresh token.",
        )

    token_hash = hash_token(refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if (
        stored is None
        or stored.revoked_on is not None
        or stored.expires_on <= now
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is revoked or expired.",
        )

    # Rotate: revoke the old token.
    stored.revoked_on = now

    user = (
        await db.execute(select(User).where(User.user_id == stored.user_id))
    ).scalar_one()
    employee = (
        await db.execute(
            select(Employee)
            .options(joinedload(Employee.role))
            .where(Employee.user_id == user.user_id)
        )
    ).scalar_one()

    tokens = await _issue_tokens(db, user, employee, device_info)
    await db.commit()
    return tokens


async def logout(db: AsyncSession, refresh_token: str) -> None:
    token_hash = hash_token(refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored = result.scalar_one_or_none()
    if stored is not None and stored.revoked_on is None:
        stored.revoked_on = datetime.now(timezone.utc)
        await db.commit()


async def forgot_password(db: AsyncSession, email: str) -> str | None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        # Do not reveal whether the email exists.
        return None

    raw_token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.user_id,
            token_hash=hash_token(raw_token),
            expires_on=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )
    await db.commit()
    return raw_token


async def reset_password(db: AsyncSession, token: str, new_password: str) -> None:
    token_hash = hash_token(token)
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash
        )
    )
    reset = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if reset is None or reset.used_on is not None or reset.expires_on <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token is invalid, used, or expired.",
        )

    user = (
        await db.execute(select(User).where(User.user_id == reset.user_id))
    ).scalar_one()
    user.password_hash = hash_password(new_password)
    user.updated_on = now
    reset.used_on = now

    # Revoke all refresh tokens on password change.
    tokens = (
        await db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user.user_id,
                RefreshToken.revoked_on.is_(None),
            )
        )
    ).scalars()
    for t in tokens:
        t.revoked_on = now

    await log_activity(
        db,
        actor_user_id=user.user_id,
        action="RESET_PASSWORD",
        entity_table="users",
        entity_id=user.user_id,
    )
    await db.commit()
