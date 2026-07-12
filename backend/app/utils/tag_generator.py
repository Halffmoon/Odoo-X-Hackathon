import re

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def generate_next_tag(
    db: AsyncSession, model, column_name: str, prefix: str, width: int = 4
) -> str:
    """Generate the next sequential tag like AF-0001 / EMP-0001.

    Queries MAX(column), parses the numeric suffix after ``<prefix>-``,
    increments, and zero-pads to ``width`` digits.
    """
    column = getattr(model, column_name)
    result = await db.execute(select(func.max(column)))
    current_max = result.scalar_one_or_none()

    next_num = 1
    if current_max:
        match = re.search(r"(\d+)$", current_max)
        if match:
            next_num = int(match.group(1)) + 1

    return f"{prefix}-{next_num:0{width}d}"
