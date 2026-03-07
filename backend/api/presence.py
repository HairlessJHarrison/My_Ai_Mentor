"""Presence module — unplugged session management."""

import datetime as dt
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.presence import PresenceSession, PresenceSessionCreate
from models.activity import Activity
from services.scoring_engine import calculate_points
from websocket import manager

router = APIRouter(prefix="/api/v1/presence", tags=["Presence"])

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


@router.post("/start", status_code=201)
async def start_session(
    body: PresenceSessionCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Start an unplugged session. Pushes presence_started to all WebSocket clients."""
    # Check for already active session
    active = session.exec(
        select(PresenceSession).where(
            PresenceSession.household_id == HOUSEHOLD_ID,
            PresenceSession.status == "active",
        )
    ).first()

    if active:
        raise HTTPException(
            status_code=409,
            detail="An unplugged session is already active",
        )

    presence = PresenceSession(
        household_id=HOUSEHOLD_ID,
        planned_duration_min=body.planned_duration_min,
        suggested_activity=body.suggested_activity,
    )
    session.add(presence)
    session.commit()
    session.refresh(presence)

    await manager.broadcast("presence_started", presence.model_dump(mode="json"))
    return presence


@router.post("/end")
async def end_session(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """End active unplugged session and auto-log scored activity."""
    active = session.exec(
        select(PresenceSession).where(
            PresenceSession.household_id == HOUSEHOLD_ID,
            PresenceSession.status == "active",
        )
    ).first()

    if not active:
        raise HTTPException(status_code=404, detail="No active unplugged session")

    # End the session
    active.end_time = dt.datetime.utcnow()
    active.status = "completed"
    session.add(active)

    # Calculate duration
    duration_min = int((active.end_time - active.start_time).total_seconds() / 60)

    # Auto-log activity
    points, multipliers = calculate_points(
        activity_type="screen_free_family",
        duration_min=duration_min,
        participants_count=1,  # Default; could be enhanced
        session=session,
        household_id=HOUSEHOLD_ID,
    )

    activity = Activity(
        household_id=HOUSEHOLD_ID,
        date=dt.date.today(),
        activity_type="screen_free_family",
        duration_min=duration_min,
        participants_count=1,
        points_earned=points,
        multipliers_applied=multipliers,
        details={"from_presence_session": active.id},
    )
    session.add(activity)
    session.commit()
    session.refresh(active)
    session.refresh(activity)

    await manager.broadcast("presence_ended", active.model_dump(mode="json"))
    await manager.broadcast("activity_scored", activity.model_dump(mode="json"))

    return {
        "session": active.model_dump(mode="json"),
        "activity": activity.model_dump(mode="json"),
    }


@router.get("/current")
async def get_current(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Get active unplugged session if any."""
    active = session.exec(
        select(PresenceSession).where(
            PresenceSession.household_id == HOUSEHOLD_ID,
            PresenceSession.status == "active",
        )
    ).first()
    return active.model_dump(mode="json") if active else None


@router.get("/stats")
async def get_stats(
    weeks: int = Query(4, ge=1, le=52, description="Number of weeks to include"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Unplugged session statistics."""
    cutoff = dt.datetime.utcnow() - dt.timedelta(weeks=weeks)

    sessions = session.exec(
        select(PresenceSession).where(
            PresenceSession.household_id == HOUSEHOLD_ID,
            PresenceSession.created_at >= cutoff,
        )
    ).all()

    completed = [s for s in sessions if s.status == "completed" and s.end_time]
    total_sessions = len(sessions)
    total_hours = sum(
        (s.end_time - s.start_time).total_seconds() / 3600
        for s in completed
    )
    avg_duration = (
        sum((s.end_time - s.start_time).total_seconds() / 60 for s in completed)
        / len(completed)
        if completed else 0
    )
    completion_rate = (len(completed) / total_sessions * 100) if total_sessions > 0 else 0

    return {
        "total_sessions": total_sessions,
        "total_hours": round(total_hours, 1),
        "avg_duration_min": round(avg_duration, 1),
        "completion_rate_pct": round(completion_rate, 1),
    }
