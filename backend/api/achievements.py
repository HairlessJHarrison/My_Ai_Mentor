"""Achievements module — per-member reward cups with CRUD, progress, and claiming."""

import datetime as dt
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func

from auth import verify_api_key
from database import get_session
from models.achievement import Achievement, AchievementCreate, AchievementUpdate
from models.chore import ChoreCompletion
from models.goal import GoalCompletion
from websocket import manager

router = APIRouter(prefix="/api/v1/achievements", tags=["Achievements"])

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


def _compute_progress(achievement: Achievement, session: Session) -> dict:
    """Compute points earned toward an achievement from chore + goal completions."""
    start_date = achievement.created_at.date() if isinstance(achievement.created_at, dt.datetime) else achievement.created_at

    chore_pts = session.exec(
        select(func.coalesce(func.sum(ChoreCompletion.points_earned), 0)).where(
            ChoreCompletion.member_id == achievement.member_id,
            ChoreCompletion.date >= start_date,
        )
    ).one()

    goal_pts = session.exec(
        select(func.coalesce(func.sum(GoalCompletion.points_earned), 0)).where(
            GoalCompletion.member_id == achievement.member_id,
            GoalCompletion.date >= start_date,
        )
    ).one()

    total = chore_pts + goal_pts
    percent = min(total / achievement.target_points * 100, 100) if achievement.target_points > 0 else 0
    return {"points_earned": total, "percent": round(percent, 1)}


@router.get("")
async def list_achievements(
    member_id: int | None = Query(None, description="Filter by member ID"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """List achievements with computed progress, optionally filtered by member."""
    stmt = select(Achievement).where(Achievement.household_id == HOUSEHOLD_ID)
    if member_id is not None:
        stmt = stmt.where(Achievement.member_id == member_id)
    achievements = session.exec(stmt).all()

    results = []
    for a in achievements:
        data = a.model_dump(mode="json")
        if a.is_active and not a.is_claimed:
            data.update(_compute_progress(a, session))
        else:
            data["points_earned"] = data.get("points_earned", 0)
            data["percent"] = 100.0 if a.is_claimed else 0.0
        results.append(data)
    return results


@router.post("", status_code=201)
async def create_achievement(
    body: AchievementCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Create a new achievement for a member."""
    achievement = Achievement.model_validate(body)
    session.add(achievement)
    session.commit()
    session.refresh(achievement)
    data = achievement.model_dump(mode="json")
    data.update(_compute_progress(achievement, session))
    return data


@router.put("/{achievement_id}")
async def update_achievement(
    achievement_id: int,
    body: AchievementUpdate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Update an achievement."""
    achievement = session.get(Achievement, achievement_id)
    if not achievement:
        raise HTTPException(status_code=404, detail="Achievement not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(achievement, key, value)

    session.add(achievement)
    session.commit()
    session.refresh(achievement)
    return achievement


@router.delete("/{achievement_id}")
async def delete_achievement(
    achievement_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Deactivate an achievement (soft delete)."""
    achievement = session.get(Achievement, achievement_id)
    if not achievement:
        raise HTTPException(status_code=404, detail="Achievement not found")

    achievement.is_active = False
    session.add(achievement)
    session.commit()
    return {"deleted": True}


@router.post("/{achievement_id}/claim")
async def claim_achievement(
    achievement_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Claim a completed achievement prize."""
    achievement = session.get(Achievement, achievement_id)
    if not achievement:
        raise HTTPException(status_code=404, detail="Achievement not found")
    if achievement.is_claimed:
        raise HTTPException(status_code=400, detail="Achievement already claimed")

    progress = _compute_progress(achievement, session)
    if progress["percent"] < 100:
        raise HTTPException(status_code=400, detail="Achievement not yet complete")

    achievement.is_claimed = True
    achievement.claimed_at = dt.datetime.now(dt.timezone.utc)
    session.add(achievement)
    session.commit()
    session.refresh(achievement)

    data = achievement.model_dump(mode="json")
    data.update(progress)
    await manager.broadcast("achievement_claimed", data)
    return data


@router.get("/{achievement_id}/progress")
async def get_achievement_progress(
    achievement_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Detailed progress for an achievement including contributing completions."""
    achievement = session.get(Achievement, achievement_id)
    if not achievement:
        raise HTTPException(status_code=404, detail="Achievement not found")

    start_date = achievement.created_at.date() if isinstance(achievement.created_at, dt.datetime) else achievement.created_at
    progress = _compute_progress(achievement, session)

    # Fetch individual completions for the log
    chore_completions = session.exec(
        select(ChoreCompletion).where(
            ChoreCompletion.member_id == achievement.member_id,
            ChoreCompletion.date >= start_date,
        ).order_by(ChoreCompletion.date.desc())
    ).all()

    goal_completions = session.exec(
        select(GoalCompletion).where(
            GoalCompletion.member_id == achievement.member_id,
            GoalCompletion.date >= start_date,
        ).order_by(GoalCompletion.date.desc())
    ).all()

    # Merge into a single sorted log
    log = []
    for cc in chore_completions:
        log.append({
            "type": "chore",
            "id": cc.id,
            "date": cc.date.isoformat(),
            "points_earned": cc.points_earned,
            "chore_id": cc.chore_id,
        })
    for gc in goal_completions:
        log.append({
            "type": "goal",
            "id": gc.id,
            "date": gc.date.isoformat(),
            "points_earned": gc.points_earned,
            "goal_id": gc.goal_id,
            "notes": gc.notes,
        })
    log.sort(key=lambda x: x["date"], reverse=True)

    data = achievement.model_dump(mode="json")
    data.update(progress)
    data["log"] = log
    return data
