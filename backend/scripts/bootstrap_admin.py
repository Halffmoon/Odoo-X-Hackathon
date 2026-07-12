"""Create or promote an ADMIN account.

Usage (from the backend/ directory, with the venv active):
    python -m scripts.bootstrap_admin --email admin@assetflow.com --password admin1234 --name "Platform Admin"

- If no user with that email exists, creates a User + Employee with the ADMIN role.
- If the user exists, promotes their employee to ADMIN (and records role history).
Idempotent: safe to run repeatedly.
"""
import argparse
import asyncio

from sqlalchemy import select

from app.database import async_session_maker
from app.models.employee import Employee, Role, RoleAssignmentHistory
from app.models.user import User
from app.utils.security import hash_password
from app.utils.tag_generator import generate_next_tag


async def _role_id(db, code: str) -> int:
    role = (
        await db.execute(select(Role).where(Role.role_code == code))
    ).scalar_one()
    return role.role_id


async def bootstrap(email: str, password: str, name: str) -> None:
    async with async_session_maker() as db:
        admin_role_id = await _role_id(db, "ADMIN")

        user = (
            await db.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()

        if user is None:
            user = User(email=email, password_hash=hash_password(password))
            db.add(user)
            await db.flush()
            code = await generate_next_tag(db, Employee, "employee_code", "EMP")
            emp = Employee(
                user_id=user.user_id,
                employee_code=code,
                name=name,
                role_id=admin_role_id,
            )
            db.add(emp)
            await db.commit()
            print(f"Created ADMIN {email} ({code}).")
            return

        emp = (
            await db.execute(
                select(Employee).where(Employee.user_id == user.user_id)
            )
        ).scalar_one_or_none()
        if emp is None:
            code = await generate_next_tag(db, Employee, "employee_code", "EMP")
            emp = Employee(
                user_id=user.user_id,
                employee_code=code,
                name=name,
                role_id=admin_role_id,
            )
            db.add(emp)
            await db.commit()
            print(f"Linked ADMIN employee to existing user {email} ({code}).")
            return

        if emp.role_id == admin_role_id:
            print(f"{email} is already ADMIN. Nothing to do.")
            return

        old_role_id = emp.role_id
        emp.role_id = admin_role_id
        db.add(
            RoleAssignmentHistory(
                employee_id=emp.employee_id,
                old_role_id=old_role_id,
                new_role_id=admin_role_id,
                changed_by=emp.employee_id,
            )
        )
        await db.commit()
        print(f"Promoted {email} to ADMIN.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create/promote an ADMIN account.")
    parser.add_argument("--email", default="admin@assetflow.com")
    parser.add_argument("--password", default="admin1234")
    parser.add_argument("--name", default="Platform Admin")
    args = parser.parse_args()
    asyncio.run(bootstrap(args.email, args.password, args.name))


if __name__ == "__main__":
    main()
