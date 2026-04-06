"""Backup API — manual trigger and listing of database snapshots."""

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException

from auth import verify_api_key
from services.backup import create_backup, list_backups

router = APIRouter(prefix="/api/v1/backups", tags=["Backups"])


@router.post("/", status_code=201)
async def trigger_backup(_auth: str = Depends(verify_api_key)):
    """Trigger an immediate database backup.

    Returns metadata for the newly created backup file.
    """
    try:
        result = create_backup()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return result


@router.get("/")
async def get_backups(_auth: str = Depends(verify_api_key)):
    """List available database backups in descending order (newest first)."""
    return {"backups": list_backups()}
