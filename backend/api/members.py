"""Members module — CRUD for family member profiles + per-member score summary."""

import datetime as dt
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.member import Member, MemberCreate, MemberUpdate
from models.activity import Activity
from models.goal import GoalCompletion
from models.chore import ChoreCompletion
from websocket import manager

router = APIRouter(prefix="/api/v1/members", tags=["Members"])

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


@router.get("")
async def list_members(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """List all household members."""
    members = session.exec(
        select(Member).where(Member.household_id == HOUSEHOLD_ID)
    ).all()
    return [m.model_dump(mode="json") for m in members]


@router.post("", status_code=201)
async def create_member(
    body: MemberCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Create a new member."""
    member = Member.model_validate(body)
    session.add(member)
    session.commit()
    session.refresh(member)
    return member


@router.put("/{member_id}")
async def update_member(
    member_id: int,
    body: MemberUpdate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Update a member."""
    member = session.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(member, key, value)

    session.add(member)
    session.commit()
    session.refresh(member)
    return member


@router.delete("/{member_id}")
async def delete_member(
    member_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Remove a member."""
    member = session.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    session.delete(member)
    session.commit()
    return {"deleted": True}


@router.get("/{member_id}/score")
async def get_member_score(
    member_id: int,
    period: str = Query("week", description="Score period: week, month, all"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Get a member's total score with breakdown by source."""
    member = session.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    today = dt.date.today()
    if period == "week":
        start_date = today - dt.timedelta(days=today.weekday())
    elif period == "month":
        start_date = today.replace(day=1)
    else:
        start_date = dt.date(2000, 1, 1)

    # Activity points (family activities where this member participated)
    activities = session.exec(
        select(Activity).where(
            Activity.household_id == HOUSEHOLD_ID,
            Activity.date >= start_date,
            Activity.date <= today,
        )
    ).all()
    # Filter to activities where this member was a participant
    # If participant_member_ids is empty (legacy data), include for all members
    activity_points = sum(
        a.points_earned for a in activities
        if not a.participant_member_ids or member_id in (a.participant_member_ids or [])
    )

    # Goal completion points
    goal_completions = session.exec(
        select(GoalCompletion).where(
            GoalCompletion.member_id == member_id,
            GoalCompletion.date >= start_date,
            GoalCompletion.date <= today,
        )
    ).all()
    goal_points = sum(gc.points_earned for gc in goal_completions)

    # Chore completion points
    chore_completions = session.exec(
        select(ChoreCompletion).where(
            ChoreCompletion.member_id == member_id,
            ChoreCompletion.date >= start_date,
            ChoreCompletion.date <= today,
        )
    ).all()
    chore_points = sum(cc.points_earned for cc in chore_completions)

    total = activity_points + goal_points + chore_points

    return {
        "member_id": member_id,
        "member_name": member.name,
        "period": period,
        "total_points": total,
        "breakdown": {
            "activities": activity_points,
            "goals": goal_points,
            "chores": chore_points,
        },
    }
