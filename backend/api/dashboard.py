"""Dashboard module — today-at-a-glance aggregated endpoint."""

import datetime as dt
import os

from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func

from auth import verify_api_key
from database import get_session
from models.achievement import Achievement
from models.chore import ChoreCompletion
from models.goal import GoalCompletion
from models.member import Member
from models.schedule import ScheduleEvent
from services.free_block_finder import find_free_blocks
from services.goal_tracker import get_goal_progress

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])
HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


@router.get("")
async def get_dashboard(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Today-at-a-glance: schedule, per-member goal streaks, and achievement progress."""
    today = dt.date.today()

    # --- Today's schedule ---
    events = session.exec(
        select(ScheduleEvent).where(ScheduleEvent.date == today)
    ).all()
    free_blocks = find_free_blocks(list(events), today)

    # --- All active members ---
    members = session.exec(
        select(Member).where(Member.household_id == HOUSEHOLD_ID)
    ).all()

    # --- Goal streaks per member ---
    member_streaks = []
    for m in members:
        goals = get_goal_progress(session, m.id, HOUSEHOLD_ID, days=30)
        member_streaks.append({
            "member": m.model_dump(mode="json"),
            "goals": goals,
        })

    # --- Achievement progress (active, unclaimed) ---
    raw_achievements = session.exec(
        select(Achievement).where(
            Achievement.household_id == HOUSEHOLD_ID,
            Achievement.is_active == True,
            Achievement.is_claimed == False,
        )
    ).all()

    achievements = []
    for a in raw_achievements:
        data = a.model_dump(mode="json")
        start_date = (
            a.created_at.date()
            if isinstance(a.created_at, dt.datetime)
            else a.created_at
        )
        chore_pts = session.exec(
            select(func.coalesce(func.sum(ChoreCompletion.points_earned), 0)).where(
                ChoreCompletion.member_id == a.member_id,
                ChoreCompletion.date >= start_date,
            )
        ).one()
        goal_pts = session.exec(
            select(func.coalesce(func.sum(GoalCompletion.points_earned), 0)).where(
                GoalCompletion.member_id == a.member_id,
                GoalCompletion.date >= start_date,
            )
        ).one()
        total = chore_pts + goal_pts
        percent = min(total / a.target_points * 100, 100) if a.target_points > 0 else 0
        data["points_earned"] = total
        data["percent"] = round(percent, 1)
        achievements.append(data)

    return {
        "date": today.isoformat(),
        "schedule": {
            "events": [e.model_dump(mode="json") for e in events],
            "free_blocks": free_blocks,
        },
        "member_streaks": member_streaks,
        "achievements": achievements,
    }
