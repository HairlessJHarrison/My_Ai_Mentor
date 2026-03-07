"""Schedule module — CRUD for events, free block analysis."""

import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.schedule import ScheduleEvent, ScheduleEventCreate, ScheduleEventUpdate
from services.free_block_finder import find_free_blocks, find_free_blocks_multi_day
from websocket import manager

router = APIRouter(prefix="/api/v1/schedules", tags=["Schedules"])

HOUSEHOLD_ID = "default"  # until multi-tenant


@router.get("/today")
async def get_today(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """All events for today with free block analysis."""
    today = dt.date.today()
    stmt = select(ScheduleEvent).where(ScheduleEvent.date == today)
    events = session.exec(stmt).all()
    free = find_free_blocks(list(events), today)
    return {
        "events": [e.model_dump(mode="json") for e in events],
        "free_blocks": free,
    }


@router.get("/week")
async def get_week(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD, defaults to Monday of current week"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Events for a given week."""
    if start_date:
        sd = dt.date.fromisoformat(start_date)
    else:
        today = dt.date.today()
        sd = today - dt.timedelta(days=today.weekday())  # Monday

    ed = sd + dt.timedelta(days=6)
    stmt = select(ScheduleEvent).where(
        ScheduleEvent.date >= sd, ScheduleEvent.date <= ed
    )
    events = session.exec(stmt).all()
    free = find_free_blocks_multi_day(list(events), sd, days=7)
    return {
        "events": [e.model_dump(mode="json") for e in events],
        "free_blocks": free,
    }


@router.get("/free-blocks")
async def get_free_blocks(
    days: int = Query(7, ge=1, le=30, description="Number of days to look ahead"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Free time windows for next N days."""
    today = dt.date.today()
    end_date = today + dt.timedelta(days=days - 1)
    stmt = select(ScheduleEvent).where(
        ScheduleEvent.date >= today, ScheduleEvent.date <= end_date
    )
    events = session.exec(stmt).all()
    return find_free_blocks_multi_day(list(events), today, days=days)


@router.post("/events", status_code=201)
async def create_event(
    body: ScheduleEventCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Create a new schedule event."""
    event = ScheduleEvent.model_validate(body, update={"household_id": body.household_id or HOUSEHOLD_ID})
    session.add(event)
    session.commit()
    session.refresh(event)
    await manager.broadcast("schedule_updated", event.model_dump(mode="json"))
    return event


@router.put("/events/{event_id}")
async def update_event(
    event_id: int,
    body: ScheduleEventUpdate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Update an existing event."""
    event = session.get(ScheduleEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(event, key, value)
    event.updated_at = dt.datetime.utcnow()

    session.add(event)
    session.commit()
    session.refresh(event)
    await manager.broadcast("schedule_updated", event.model_dump(mode="json"))
    return event


@router.put("/events/{event_id}/protect")
async def protect_event(
    event_id: int,
    body: dict,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Mark/unmark a time block as protected."""
    event = session.get(ScheduleEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.is_protected = body.get("is_protected", False)
    event.updated_at = dt.datetime.utcnow()
    session.add(event)
    session.commit()
    session.refresh(event)
    await manager.broadcast("schedule_updated", event.model_dump(mode="json"))
    return event


@router.delete("/events/{event_id}")
async def delete_event(
    event_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Delete a schedule event."""
    event = session.get(ScheduleEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    session.delete(event)
    session.commit()
    await manager.broadcast("schedule_updated", {"id": event_id, "deleted": True})
    return {"deleted": True}
