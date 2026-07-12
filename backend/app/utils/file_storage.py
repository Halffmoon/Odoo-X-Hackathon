import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import settings


def _safe_name(filename: str | None) -> str:
    base = Path(filename or "upload").name
    return base.replace(" ", "_")


async def save_upload(subdir: str, file: UploadFile) -> str:
    """Persist an UploadFile under UPLOAD_DIR/<subdir> and return its URL path."""
    dest_dir = Path(settings.UPLOAD_DIR) / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)
    unique = f"{uuid.uuid4().hex}_{_safe_name(file.filename)}"
    dest = dest_dir / unique
    content = await file.read()
    dest.write_bytes(content)
    # URL path served relative to the app; frontend prefixes the API host.
    return f"/{settings.UPLOAD_DIR}/{subdir}/{unique}"


def infer_file_type(file: UploadFile) -> str:
    ctype = (file.content_type or "").lower()
    return "PHOTO" if ctype.startswith("image/") else "DOCUMENT"
