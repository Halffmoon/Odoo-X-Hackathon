import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.employee import Employee
from app.utils.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Employee:
    if not token:
        raise _CREDENTIALS_EXC
    try:
        payload = decode_token(token)
    except JWTError:
        raise _CREDENTIALS_EXC

    if payload.get("type") != "access":
        raise _CREDENTIALS_EXC

    user_id = payload.get("sub")
    if not user_id:
        raise _CREDENTIALS_EXC

    result = await db.execute(
        select(Employee)
        .options(joinedload(Employee.role))
        .where(Employee.user_id == uuid.UUID(user_id))
    )
    employee = result.scalar_one_or_none()
    if employee is None or employee.is_deleted or employee.status != "ACTIVE":
        raise _CREDENTIALS_EXC

    return employee


def require_roles(*allowed_roles: str):
    """Dependency factory: allow only the given role_codes."""

    async def checker(
        current_user: Employee = Depends(get_current_user),
    ) -> Employee:
        if current_user.role.role_code not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return checker
