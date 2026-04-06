"""Kiosk module — display kiosk settings and screensaver photo management."""

import datetime as dt
import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.kiosk import KioskSettings, KioskSettingsUpdate

router = APIRouter(prefix="/api/v1/kiosk", tags=["Kiosk"])

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")
PHOTOS_DIR = Path(os.getenv("PHOTOS_DIR", "data/photos"))
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def _ensure_photos_dir():
    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)


# ── Settings ──────────────────────────────────────────────────────────────────

@router.get("/settings")
async def get_kiosk_settings(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Get kiosk display settings for this household."""
    settings = session.exec(
        select(KioskSettings).where(KioskSettings.household_id == HOUSEHOLD_ID)
    ).first()

    if not settings:
        return {
            "household_id": HOUSEHOLD_ID,
            "enabled": False,
            "auto_fullscreen": False,
            "idle_timeout_seconds": 120,
            "family_name": "Our Family",
        }

    return settings.model_dump(mode="json")


@router.put("/settings")
async def update_kiosk_settings(
    body: KioskSettingsUpdate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Update kiosk display settings. Creates record if it doesn't exist."""
    settings = session.exec(
        select(KioskSettings).where(KioskSettings.household_id == HOUSEHOLD_ID)
    ).first()

    if not settings:
        settings = KioskSettings(household_id=HOUSEHOLD_ID)

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)
    settings.updated_at = dt.datetime.now(dt.timezone.utc)

    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings.model_dump(mode="json")


# ── Photos ────────────────────────────────────────────────────────────────────

@router.get("/photos")
async def list_photos(_auth: str = Depends(verify_api_key)):
    """List all uploaded screensaver photos."""
    _ensure_photos_dir()
    photos = []
    for path in sorted(PHOTOS_DIR.iterdir()):
        if path.is_file() and path.suffix.lower() in ALLOWED_EXTENSIONS:
            photos.append({"filename": path.name, "url": f"/photos/{path.name}"})
    return photos


@router.post("/photos")
async def upload_photo(
    file: UploadFile = File(...),
    _auth: str = Depends(verify_api_key),
):
    """Upload a photo to the screensaver library."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    _ensure_photos_dir()
    filename = f"{uuid.uuid4()}{ext}"
    dest = PHOTOS_DIR / filename

    content = await file.read()
    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)

    return {"filename": filename, "url": f"/photos/{filename}"}


@router.delete("/photos/{filename}")
async def delete_photo(
    filename: str,
    _auth: str = Depends(verify_api_key),
):
    """Delete a screensaver photo by filename."""
    # Prevent path traversal by taking only the basename
    safe_name = Path(filename).name
    path = PHOTOS_DIR / safe_name

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Photo not found")

    path.unlink()
    return {"deleted": safe_name}
