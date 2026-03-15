"""Chores module — CRUD for chores, completion logging, verification, and daily status."""

import datetime as dt
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.chore import (
    Chore, ChoreCreate, ChoreUpdate,
    ChoreCompletion, ChoreCompleteRequest,
)
from models.member import Member
from websocket import manager

router = APIRouter(prefix="/api/v1/chores", tags=["Chores"])


def chore_is_scheduled_for_date(chore, check_date: dt.date) -> bool:
    """Return True if a chore should appear on the given date based on its schedule."""
    freq = chore.frequency or "daily"

    if freq in ("daily", "as_needed"):
        return True

    if freq == "weekly":
        if chore.schedule_day is None:
            return True  # no day set yet, show every day as fallback
        return check_date.weekday() == chore.schedule_day

    if freq == "biweekly":
        if chore.schedule_day is None or chore.schedule_anchor_date is None:
            return True  # fallback
        if check_date.weekday() != chore.schedule_day:
            return False
        anchor = dt.date.fromisoformat(chore.schedule_anchor_date)
        delta_days = (check_date - anchor).days
        week_number = delta_days // 7
        return week_number % 2 == 0

    if freq == "monthly":
        if chore.schedule_day is None or chore.schedule_week_of_month is None:
            return True  # fallback
        if check_date.weekday() != chore.schedule_day:
            return False
        occurrence = (check_date.day - 1) // 7 + 1
        return occurrence == chore.schedule_week_of_month

    return True  # unknown frequency, show it

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


@router.get("")
async def list_chores(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """List all household chores."""
    chores = session.exec(
        select(Chore).where(
            Chore.household_id == HOUSEHOLD_ID,
            Chore.is_active == True,
        )
    ).all()
    return [c.model_dump(mode="json") for c in chores]


@router.post("", status_code=201)
async def create_chore(
    body: ChoreCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Create a new chore."""
    chore = Chore.model_validate(body)
    session.add(chore)
    session.commit()
    session.refresh(chore)
    return chore


@router.put("/{chore_id}")
async def update_chore(
    chore_id: int,
    body: ChoreUpdate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Update a chore."""
    chore = session.get(Chore, chore_id)
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(chore, key, value)

    session.add(chore)
    session.commit()
    session.refresh(chore)
    return chore


@router.delete("/{chore_id}")
async def delete_chore(
    chore_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Deactivate a chore."""
    chore = session.get(Chore, chore_id)
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")

    chore.is_active = False
    session.add(chore)
    session.commit()
    return {"deleted": True}


@router.post("/complete", status_code=201)
async def complete_chore(
    body: ChoreCompleteRequest,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Log a chore completion."""
    chore = session.get(Chore, body.chore_id)
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    if not chore.is_active:
        raise HTTPException(status_code=400, detail="Chore is not active")

    completion = ChoreCompletion(
        household_id=chore.household_id,
        chore_id=body.chore_id,
        member_id=body.member_id,
        date=dt.date.today(),
        points_earned=chore.points,
    )
    session.add(completion)
    session.commit()
    session.refresh(completion)

    await manager.broadcast("chore_completed", completion.model_dump(mode="json"))
    return completion


@router.post("/verify/{completion_id}")
async def verify_chore(
    completion_id: int,
    body: dict,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Parent verifies a chore completion."""
    completion = session.get(ChoreCompletion, completion_id)
    if not completion:
        raise HTTPException(status_code=404, detail="Chore completion not found")

    verified_by = body.get("verified_by")
    if verified_by is None:
        raise HTTPException(status_code=400, detail="verified_by member_id required")

    # Verify the verifier is a parent
    verifier = session.get(Member, verified_by)
    if not verifier or verifier.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can verify chores")

    completion.verified_by = verified_by
    session.add(completion)
    session.commit()
    session.refresh(completion)

    await manager.broadcast("chore_verified", completion.model_dump(mode="json"))
    return completion


@router.get("/status")
async def get_chore_status(
    date: str | None = Query(None, description="Date in YYYY-MM-DD format, defaults to today"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Today's chore status per member."""
    check_date = dt.date.fromisoformat(date) if date else dt.date.today()

    members = session.exec(
        select(Member).where(Member.household_id == HOUSEHOLD_ID)
    ).all()

    all_chores = session.exec(
        select(Chore).where(
            Chore.household_id == HOUSEHOLD_ID,
            Chore.is_active == True,
        )
    ).all()
    chores = [c for c in all_chores if chore_is_scheduled_for_date(c, check_date)]

    completions = session.exec(
        select(ChoreCompletion).where(
            ChoreCompletion.household_id == HOUSEHOLD_ID,
            ChoreCompletion.date == check_date,
        )
    ).all()

    # Build completion lookup: (chore_id, member_id) -> True
    completed_set = {(c.chore_id, c.member_id) for c in completions}

    result = []
    for member in members:
        member_chores = []
        for chore in chores:
            # Check if this chore is assigned to this member (or to everyone)
            if chore.assigned_member_ids and member.id not in chore.assigned_member_ids:
                continue
            member_chores.append({
                "chore": chore.model_dump(mode="json"),
                "completed": (chore.id, member.id) in completed_set,
            })
        result.append({
            "member_id": member.id,
            "member_name": member.name,
            "chores": member_chores,
        })

    return {"members": result}
