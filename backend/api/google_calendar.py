"""Google Calendar integration — OAuth2 flow and sync endpoints."""

import os

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session

from auth import verify_api_key
from database import get_session
from models.member import Member
from services.google_calendar import (
    get_auth_url,
    exchange_code,
    sync_member_calendar,
    disconnect_member,
)
from websocket import manager

router = APIRouter(prefix="/api/v1/google-calendar", tags=["Google Calendar"])

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


class OAuthCallback(BaseModel):
    code: str
    state: str


@router.get("/auth-url")
async def google_auth_url(
    member_id: int = Query(..., description="Member ID to authorize"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Get Google OAuth2 authorization URL for a member."""
    member = session.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    try:
        url = get_auth_url(member_id)
    except KeyError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Missing environment variable: {e}",
        )
    return {"url": url}


@router.post("/callback")
async def google_callback(
    body: OAuthCallback,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Handle Google OAuth2 callback and store credentials."""
    member_id = int(body.state)
    member = session.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    try:
        credentials = exchange_code(body.code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth exchange failed: {e}")

    member.google_credentials = credentials
    member.google_calendar_id = "primary"
    session.add(member)
    session.commit()

    return {"success": True, "member_id": member_id}


@router.post("/sync/{member_id}")
async def sync_calendar(
    member_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Trigger a two-way sync for a member's Google Calendar."""
    member = session.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if not member.google_credentials:
        raise HTTPException(status_code=400, detail="Member has no Google Calendar connected")

    try:
        result = sync_member_calendar(member, session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {e}")

    await manager.broadcast("calendar_synced", {
        "member_id": member_id,
        "imported": result["imported"],
        "exported": result["exported"],
        "updated": result["updated"],
    })
    return result


@router.delete("/disconnect/{member_id}")
async def disconnect_calendar(
    member_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Disconnect a member's Google Calendar."""
    member = session.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    disconnect_member(member, session)
    return {"disconnected": True}
