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
    GoalMilestone, GoalMilestoneCreate, GoalMilestoneUpdate,
)
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


@router.get("/{goal_id}/milestones")
async def list_milestones(
    goal_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """List milestones for a goal, ordered by display order."""
    goal = session.get(PersonalGoal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    stmt = select(GoalMilestone).where(
        GoalMilestone.goal_id == goal_id
    ).order_by(GoalMilestone.order, GoalMilestone.created_at)
    milestones = session.exec(stmt).all()
    completed = sum(1 for m in milestones if m.completed)
    return {
        "milestones": [m.model_dump(mode="json") for m in milestones],
        "total": len(milestones),
        "completed": completed,
    }


@router.post("/{goal_id}/milestones", status_code=201)
async def create_milestone(
    goal_id: int,
    body: GoalMilestoneCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Add a milestone to a goal."""
    goal = session.get(PersonalGoal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    milestone = GoalMilestone(
        household_id=goal.household_id,
        goal_id=goal_id,
        title=body.title,
        order=body.order,
        points_reward=body.points_reward,
    )
    session.add(milestone)
    session.commit()
    session.refresh(milestone)
    return milestone


@router.put("/{goal_id}/milestones/{milestone_id}")
async def update_milestone(
    goal_id: int,
    milestone_id: int,
    body: GoalMilestoneUpdate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Update a milestone."""
    milestone = session.get(GoalMilestone, milestone_id)
    if not milestone or milestone.goal_id != goal_id:
        raise HTTPException(status_code=404, detail="Milestone not found")
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(milestone, key, value)
    session.add(milestone)
    session.commit()
    session.refresh(milestone)
    return milestone


@router.delete("/{goal_id}/milestones/{milestone_id}")
async def delete_milestone(
    goal_id: int,
    milestone_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Delete a milestone."""
    milestone = session.get(GoalMilestone, milestone_id)
    if not milestone or milestone.goal_id != goal_id:
        raise HTTPException(status_code=404, detail="Milestone not found")
    session.delete(milestone)
    session.commit()
    return {"deleted": True}


@router.post("/{goal_id}/milestones/{milestone_id}/complete", status_code=201)
async def complete_milestone(
    goal_id: int,
    milestone_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Complete a milestone, awarding points. Points split from goal if not set on milestone."""
    goal = session.get(PersonalGoal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    milestone = session.get(GoalMilestone, milestone_id)
    if not milestone or milestone.goal_id != goal_id:
        raise HTTPException(status_code=404, detail="Milestone not found")
    if milestone.completed:
        raise HTTPException(status_code=400, detail="Milestone already completed")

    # Determine points: use milestone's own reward, or auto-split from goal
    if milestone.points_reward > 0:
        points = milestone.points_reward
    else:
        total_milestones = session.exec(
            select(GoalMilestone).where(GoalMilestone.goal_id == goal_id)
        ).all()
        points = max(1, round(goal.points_per_completion / max(len(total_milestones), 1)))

    milestone.completed = True
    milestone.completed_at = dt.datetime.utcnow()
    session.add(milestone)

    # Create a GoalCompletion so it counts toward achievements
    completion = GoalCompletion(
        household_id=goal.household_id,
        goal_id=goal_id,
        member_id=goal.member_id,
        date=dt.date.today(),
        notes=f"Milestone: {milestone.title}",
        points_earned=points,
    )
    session.add(completion)
    session.commit()
    session.refresh(milestone)
    session.refresh(completion)

    await manager.broadcast("goal_completed", completion.model_dump(mode="json"))
    return {
        "milestone": milestone.model_dump(mode="json"),
        "points_earned": points,
    }


@router.get("/progress")
async def get_progress(
    member_id: int = Query(..., description="Member ID"),
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Goal completion history and streaks for a member."""
    return {"goals": get_goal_progress(session, member_id, HOUSEHOLD_ID, days)}
