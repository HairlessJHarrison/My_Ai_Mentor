"""Schedule module — CRUD for events, free block analysis."""

import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.schedule import ScheduleEvent, ScheduleEventCreate, ScheduleEventUpdate
from services.free_block_finder import find_free_blocks, find_free_blocks_multi_day
from services.recurrence import expand_recurrence, instance_as_event_like
from services.travel_time import calculate_travel_time
from websocket import manager

router = APIRouter(prefix="/api/v1/schedules", tags=["Schedules"])

HOUSEHOLD_ID = "default"  # until multi-tenant


def _fetch_events_with_recurrence(
    session: Session,
    start_date: dt.date,
    end_date: dt.date,
) -> tuple[list[ScheduleEvent], list[dict], list]:
    """Return (stored_events, recurring_instances, combined_event_likes) for a date range.

    stored_events      — one-time ScheduleEvent rows that fall within the range.
    recurring_instances — expanded occurrence dicts for every recurring event.
    combined_event_likes — list of objects (ScheduleEvent or SimpleNamespace) that
                           expose .date/.start_time/.end_time/.participants for
                           use by find_free_blocks helpers.
    """
    # One-time events in range
    one_time_stmt = select(ScheduleEvent).where(
        ScheduleEvent.date >= start_date,
        ScheduleEvent.date <= end_date,
        ScheduleEvent.recurrence_rule.is_(None),  # type: ignore[attr-defined]
    )
    stored = list(session.exec(one_time_stmt).all())

    # All recurring event templates (started on or before end_date)
    recurring_stmt = select(ScheduleEvent).where(
        ScheduleEvent.date <= end_date,
        ScheduleEvent.recurrence_rule.isnot(None),  # type: ignore[attr-defined]
    )
    recurring_templates = list(session.exec(recurring_stmt).all())

    recurring_instances: list[dict] = []
    for template in recurring_templates:
        recurring_instances.extend(expand_recurrence(template, start_date, end_date))

    combined_event_likes = list(stored) + [
        instance_as_event_like(inst) for inst in recurring_instances
    ]

    return stored, recurring_instances, combined_event_likes


@router.get("/today")
async def get_today(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """All events for today with free block analysis."""
    today = dt.date.today()
    stored, recurring_instances, event_likes = _fetch_events_with_recurrence(
        session, today, today
    )
    free = find_free_blocks(event_likes, today)
    return {
        "events": [e.model_dump(mode="json") for e in stored] + recurring_instances,
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
    stored, recurring_instances, event_likes = _fetch_events_with_recurrence(
        session, sd, ed
    )
    free = find_free_blocks_multi_day(event_likes, sd, days=7)
    return {
        "events": [e.model_dump(mode="json") for e in stored] + recurring_instances,
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
    _, _, event_likes = _fetch_events_with_recurrence(session, today, end_date)
    return find_free_blocks_multi_day(event_likes, today, days=days)


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


@router.get("/member/{member_id}")
async def get_member_schedule(
    member_id: int,
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD, defaults to Monday of current week"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Events for a specific member."""
    if start_date:
        sd = dt.date.fromisoformat(start_date)
    else:
        today = dt.date.today()
        sd = today - dt.timedelta(days=today.weekday())

    ed = sd + dt.timedelta(days=6)
    stored, recurring_instances, event_likes = _fetch_events_with_recurrence(
        session, sd, ed
    )

    # Filter stored events to this member
    member_stored = [e for e in stored if member_id in (e.assigned_member_ids or [])]
    # Filter recurring instances to this member
    member_recurring = [
        inst for inst in recurring_instances
        if member_id in (inst.get("assigned_member_ids") or [])
    ]
    # Filter event_likes to this member for free-block calculation
    member_event_likes = [
        el for el in event_likes
        if member_id in (el.assigned_member_ids or [])
    ]

    free = find_free_blocks_multi_day(member_event_likes, sd, days=7)
    return {
        "events": [e.model_dump(mode="json") for e in member_stored] + member_recurring,
        "free_blocks": free,
    }


@router.get("/travel-time")
async def get_travel_time(
    origin: str = Query(..., description="Origin address or place name", alias="from"),
    destination: str = Query(..., description="Destination address or place name", alias="to"),
    _auth: str = Depends(verify_api_key),
):
    """Calculate travel time between two locations via Google Maps."""
    try:
        result = calculate_travel_time(origin, destination)
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/events/{event_id}/auto-travel")
async def auto_travel_time(
    event_id: int,
    body: dict,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Auto-calculate and set travel time for an event using Google Maps."""
    event = session.get(ScheduleEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not event.location:
        raise HTTPException(status_code=400, detail="Event has no location set")

    from_location = body.get("from_location")
    if not from_location:
        raise HTTPException(status_code=400, detail="from_location is required")

    try:
        result = calculate_travel_time(from_location, event.location)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    event.travel_time_min = result["duration_min"]
    event.updated_at = dt.datetime.utcnow()
    session.add(event)
    session.commit()
    session.refresh(event)

    await manager.broadcast("schedule_updated", event.model_dump(mode="json"))
    return event
