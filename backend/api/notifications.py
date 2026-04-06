"""Notifications module — in-app notifications and reminder configuration."""

import datetime as dt
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.notification import (
    Notification, NotificationCreate,
    ReminderConfig, ReminderConfigUpdate,
)
from websocket import manager

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


# ── Notification CRUD ──────────────────────────────────────────────────────────

@router.get("")
async def list_notifications(
    member_id: int | None = Query(None, description="Filter by member ID"),
    unread_only: bool = Query(False, description="Return only unread notifications"),
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """List notifications for the household, optionally filtered by member or read status."""
    stmt = (
        select(Notification)
        .where(Notification.household_id == HOUSEHOLD_ID)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if member_id is not None:
        stmt = stmt.where(
            (Notification.member_id == member_id) | (Notification.member_id == None)
        )
    if unread_only:
        stmt = stmt.where(Notification.read == False)
    return session.exec(stmt).all()


@router.get("/unread-count")
async def unread_count(
    member_id: int | None = Query(None, description="Member ID to count for"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Return the number of unread notifications."""
    stmt = (
        select(Notification)
        .where(Notification.household_id == HOUSEHOLD_ID)
        .where(Notification.read == False)
    )
    if member_id is not None:
        stmt = stmt.where(
            (Notification.member_id == member_id) | (Notification.member_id == None)
        )
    count = len(session.exec(stmt).all())
    return {"count": count}


@router.post("", status_code=201)
async def create_notification(
    body: NotificationCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Manually create a notification (useful for AI agents)."""
    notif = Notification(
        household_id=HOUSEHOLD_ID,
        member_id=body.member_id,
        message=body.message,
        type=body.type,
    )
    session.add(notif)
    session.commit()
    session.refresh(notif)
    await manager.broadcast("notification_created", notif.model_dump(mode="json"))
    return notif


@router.put("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Mark a single notification as read."""
    notif = session.get(Notification, notification_id)
    if not notif or notif.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.read = True
    session.add(notif)
    session.commit()
    session.refresh(notif)
    return notif


@router.put("/read-all")
async def mark_all_read(
    member_id: int | None = Query(None),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Mark all (or a member's) notifications as read."""
    stmt = (
        select(Notification)
        .where(Notification.household_id == HOUSEHOLD_ID)
        .where(Notification.read == False)
    )
    if member_id is not None:
        stmt = stmt.where(
            (Notification.member_id == member_id) | (Notification.member_id == None)
        )
    notifications = session.exec(stmt).all()
    for n in notifications:
        n.read = True
        session.add(n)
    session.commit()
    return {"marked_read": len(notifications)}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Delete a notification."""
    notif = session.get(Notification, notification_id)
    if not notif or notif.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Notification not found")
    session.delete(notif)
    session.commit()
    return {"deleted": True}


# ── Reminder Config ────────────────────────────────────────────────────────────

@router.get("/reminder-config")
async def get_reminder_config(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Get all reminder configs (global + per-member overrides)."""
    configs = session.exec(
        select(ReminderConfig).where(ReminderConfig.household_id == HOUSEHOLD_ID)
    ).all()
    return configs


@router.put("/reminder-config")
async def upsert_reminder_config(
    body: ReminderConfigUpdate,
    member_id: int | None = Query(None, description="Member ID, or omit for global default"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Create or update a reminder config for a specific member or the global default."""
    config = session.exec(
        select(ReminderConfig).where(
            ReminderConfig.household_id == HOUSEHOLD_ID,
            ReminderConfig.member_id == member_id,
        )
    ).first()

    if not config:
        config = ReminderConfig(
            household_id=HOUSEHOLD_ID,
            member_id=member_id,
        )

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)

    session.add(config)
    session.commit()
    session.refresh(config)
    return config
