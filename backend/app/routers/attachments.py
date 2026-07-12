import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles
from app.models.employee import Employee
from app.schemas.common import MessageResponse
from app.services import asset_service

router = APIRouter(prefix="/api/attachments", tags=["attachments"])


@router.delete("/{attachment_id}", response_model=MessageResponse)
async def delete_attachment(
    attachment_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: Employee = Depends(require_roles("ADMIN", "ASSET_MANAGER")),
):
    ip = request.client.host if request.client else None
    await asset_service.delete_attachment(db, attachment_id, actor, ip)
    return MessageResponse(message="Attachment deleted.")
