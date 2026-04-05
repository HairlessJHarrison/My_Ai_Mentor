"""Goals module — personal goals CRUD, completion logging, and progress tracking."""

import datetime as dt
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.goal import (
    PersonalGoal, PersonalGoalCreate, PersonalGoalUpdate,
    GoalCompletion, GoalCompleteRequest,
)
from models.chore import ChoreCompletion
from services.goal_tracker import calculate_goal_points, get_goal_progress
from websocket import manager

router = APIRouter(prefix="/api/v1/goals", tags=["Goals"])

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


@router.get("")
async def list_goals(
    member_id: int | None = Query(None, description="Filter by member ID"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """List goals, optionally filtered by member."""
    stmt = select(PersonalGoal).where(PersonalGoal.household_id == HOUSEHOLD_ID)
    if member_id is not None:
        stmt = stmt.where(PersonalGoal.member_id == member_id)
    goals = session.exec(stmt).all()
    return [g.model_dump(mode="json") for g in goals]


@router.post("", status_code=201)
async def create_goal(
    body: PersonalGoalCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Create a new personal goal."""
    goal = PersonalGoal.model_validate(body)
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal


@router.put("/{goal_id}")
async def update_goal(
    goal_id: int,
    body: PersonalGoalUpdate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Update a goal."""
    goal = session.get(PersonalGoal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(goal, key, value)

    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Deactivate a goal."""
    goal = session.get(PersonalGoal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.is_active = False
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return {"deleted": True}


@router.post("/complete", status_code=201)
async def complete_goal(
    body: GoalCompleteRequest,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Log a goal completion. Points calculated server-side with streak multipliers."""
    goal = session.get(PersonalGoal, body.goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    if not goal.is_active:
        raise HTTPException(status_code=400, detail="Goal is not active")

    points = calculate_goal_points(goal, body.member_id, session)

    completion = GoalCompletion(
        household_id=goal.household_id,
        goal_id=body.goal_id,
        member_id=body.member_id,
        date=dt.date.today(),
        duration_min=body.duration_min,
        notes=body.notes,
        points_earned=points,
    )
    session.add(completion)
    session.commit()
    session.refresh(completion)

    await manager.broadcast("goal_completed", completion.model_dump(mode="json"))
    return completion


@router.get("/points-history")
async def get_points_history(
    member_id: int = Query(..., description="Member ID"),
    days: int = Query(30, ge=7, le=90, description="Number of days to look back"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Points earned per day for a member, combining goals and chores."""
    today = dt.date.today()
    start = today - dt.timedelta(days=days - 1)

    goal_completions = session.exec(
        select(GoalCompletion).where(
            GoalCompletion.household_id == HOUSEHOLD_ID,
            GoalCompletion.member_id == member_id,
            GoalCompletion.date >= start,
            GoalCompletion.date <= today,
        )
    ).all()

    chore_completions = session.exec(
        select(ChoreCompletion).where(
            ChoreCompletion.household_id == HOUSEHOLD_ID,
            ChoreCompletion.member_id == member_id,
            ChoreCompletion.date >= start,
            ChoreCompletion.date <= today,
        )
    ).all()

    data: dict[str, dict] = {}
    for i in range(days):
        d = start + dt.timedelta(days=i)
        data[str(d)] = {"date": str(d), "goal_points": 0, "chore_points": 0, "total": 0}

    for c in goal_completions:
        key = str(c.date)
        if key in data:
            data[key]["goal_points"] += c.points_earned
            data[key]["total"] += c.points_earned

    for c in chore_completions:
        key = str(c.date)
        if key in data:
            data[key]["chore_points"] += c.points_earned
            data[key]["total"] += c.points_earned

    return {"days": list(data.values())}


@router.get("/progress")
async def get_progress(
    member_id: int = Query(..., description="Member ID"),
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Goal completion history and streaks for a member."""
    return {"goals": get_goal_progress(session, member_id, HOUSEHOLD_ID, days)}
