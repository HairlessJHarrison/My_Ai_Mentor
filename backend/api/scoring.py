"""Scoring module — log activities, view trends, check streaks."""

import datetime as dt
import os

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.activity import Activity, ActivityCreate
from services.scoring_engine import calculate_points, get_streaks, get_weekly_trends
from websocket import manager

router = APIRouter(prefix="/api/v1/scoring", tags=["Scoring"])

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


@router.post("/log-activity", status_code=201)
async def log_activity(
    body: ActivityCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Log a scored activity. Points are calculated server-side.

    If participant_member_ids is provided, participants_count is auto-set
    to the length of that list, and each member earns the calculated points.
    """
    # Auto-infer participants_count from member IDs if provided
    participants_count = body.participants_count
    if body.participant_member_ids:
        participants_count = len(body.participant_member_ids)

    points, multipliers = calculate_points(
        activity_type=body.activity_type,
        duration_min=body.duration_min,
        participants_count=participants_count,
        session=session,
        household_id=HOUSEHOLD_ID,
        details=body.details,
    )

    activity = Activity(
        household_id=HOUSEHOLD_ID,
        date=dt.date.today(),
        activity_type=body.activity_type,
        duration_min=body.duration_min,
        participants_count=participants_count,
        participant_member_ids=body.participant_member_ids,
        details=body.details,
        points_earned=points,
        multipliers_applied=multipliers,
    )
    session.add(activity)
    session.commit()
    session.refresh(activity)

    await manager.broadcast("activity_scored", activity.model_dump(mode="json"))
    return activity


@router.get("/today")
async def get_today(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Today's activities and total points."""
    today = dt.date.today()
    activities = session.exec(
        select(Activity).where(
            Activity.household_id == HOUSEHOLD_ID,
            Activity.date == today,
        )
    ).all()

    total_points = sum(a.points_earned for a in activities)
    return {
        "activities": [a.model_dump(mode="json") for a in activities],
        "total_points": total_points,
    }


@router.get("/trends")
async def get_trends(
    weeks: int = 4,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Weekly presence score trends."""
    return {"weeks": get_weekly_trends(session, HOUSEHOLD_ID, weeks)}


@router.get("/streaks")
async def get_streaks_endpoint(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Current active streaks."""
    return {"streaks": get_streaks(session, HOUSEHOLD_ID)}


@router.get("/cup")
async def get_cup_progress(
    since: str = None,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Achievement cup progress since a specific date."""
    query = select(Activity).where(Activity.household_id == HOUSEHOLD_ID)
    if since:
        try:
            since_date = dt.datetime.fromisoformat(since).date()
            query = query.where(Activity.date >= since_date)
        except ValueError:
            pass

    activities = session.exec(query.order_by(Activity.date.desc(), Activity.id.desc())).all()
    total_points = sum(a.points_earned for a in activities)
    
    return {
        "activities": [a.model_dump(mode="json") for a in activities],
        "total_points": total_points,
    }
