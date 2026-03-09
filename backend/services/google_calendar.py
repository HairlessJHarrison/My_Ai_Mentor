"""Google Calendar two-way sync service — OAuth2 flow and event synchronisation."""

import datetime as dt
import json
import os

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlmodel import Session, select

from models.member import Member
from models.schedule import ScheduleEvent

SCOPES = ["https://www.googleapis.com/auth/calendar"]

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


# ---------------------------------------------------------------------------
# OAuth2 helpers
# ---------------------------------------------------------------------------

def _client_config() -> dict:
    """Build OAuth2 client config from environment variables."""
    return {
        "web": {
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [os.environ["GOOGLE_REDIRECT_URI"]],
        }
    }


def get_auth_url(member_id: int) -> str:
    """Return the Google OAuth2 authorization URL for a member."""
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES)
    flow.redirect_uri = os.environ["GOOGLE_REDIRECT_URI"]
    url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=str(member_id),
    )
    return url


def exchange_code(code: str) -> dict:
    """Exchange an authorization code for credentials and return serialized dict."""
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES)
    flow.redirect_uri = os.environ["GOOGLE_REDIRECT_URI"]
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes or []),
        "expiry": creds.expiry.isoformat() if creds.expiry else None,
    }


def _build_service(member: Member, session: Session):
    """Build a Google Calendar API service from stored member credentials."""
    creds_data = member.google_credentials
    if not creds_data:
        raise ValueError("Member has no Google credentials stored")

    creds = Credentials(
        token=creds_data["token"],
        refresh_token=creds_data.get("refresh_token"),
        token_uri=creds_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=creds_data.get("client_id"),
        client_secret=creds_data.get("client_secret"),
        scopes=creds_data.get("scopes"),
    )

    # Refresh expired token
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        # Persist refreshed credentials
        member.google_credentials = {
            **creds_data,
            "token": creds.token,
            "expiry": creds.expiry.isoformat() if creds.expiry else None,
        }
        session.add(member)
        session.commit()

    return build("calendar", "v3", credentials=creds)


# ---------------------------------------------------------------------------
# Conversion helpers
# ---------------------------------------------------------------------------

def _google_event_to_schedule_data(event: dict, member: Member) -> dict:
    """Convert a Google Calendar event to ScheduleEvent-compatible dict."""
    start = event.get("start", {})
    end = event.get("end", {})

    # Google events can use dateTime (timed) or date (all-day)
    if "dateTime" in start:
        start_dt = dt.datetime.fromisoformat(start["dateTime"])
        end_dt = dt.datetime.fromisoformat(end["dateTime"])
        event_date = start_dt.date()
        start_time = start_dt.time()
        end_time = end_dt.time()
    else:
        event_date = dt.date.fromisoformat(start.get("date", str(dt.date.today())))
        start_time = dt.time(0, 0)
        end_time = dt.time(23, 59)

    return {
        "household_id": HOUSEHOLD_ID,
        "date": event_date,
        "start_time": start_time,
        "end_time": end_time,
        "title": event.get("summary", "Untitled"),
        "event_type": "other",
        "is_protected": False,
        "participants": [],
        "assigned_member_ids": [member.id],
        "location": event.get("location"),
        "travel_time_min": None,
        "google_event_id": event["id"],
        "recurrence_rule": None,
        "source": "google_calendar",
    }


def _schedule_event_to_google(event: ScheduleEvent) -> dict:
    """Convert a ScheduleEvent to a Google Calendar event body."""
    start_dt = dt.datetime.combine(event.date, event.start_time)
    end_dt = dt.datetime.combine(event.date, event.end_time)

    body = {
        "summary": event.title,
        "start": {"dateTime": start_dt.isoformat(), "timeZone": "America/New_York"},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": "America/New_York"},
    }
    if event.location:
        body["location"] = event.location
    return body


# ---------------------------------------------------------------------------
# Sync logic
# ---------------------------------------------------------------------------

def sync_member_calendar(member: Member, session: Session) -> dict:
    """Two-way sync between local schedule and Google Calendar.

    Returns dict with counts: {imported, exported, updated}.
    """
    service = _build_service(member, session)
    calendar_id = member.google_calendar_id or "primary"

    imported = 0
    exported = 0
    updated = 0

    # --- Import from Google ---
    now = dt.datetime.utcnow()
    time_min = (now - dt.timedelta(days=7)).isoformat() + "Z"
    time_max = (now + dt.timedelta(days=30)).isoformat() + "Z"

    page_token = None
    while True:
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
            pageToken=page_token,
        ).execute()

        for g_event in events_result.get("items", []):
            if g_event.get("status") == "cancelled":
                continue

            g_id = g_event["id"]
            existing = session.exec(
                select(ScheduleEvent).where(ScheduleEvent.google_event_id == g_id)
            ).first()

            if existing:
                # Update local event if Google version changed
                data = _google_event_to_schedule_data(g_event, member)
                changed = False
                for field in ("title", "date", "start_time", "end_time", "location"):
                    new_val = data[field]
                    if getattr(existing, field) != new_val:
                        setattr(existing, field, new_val)
                        changed = True
                if changed:
                    existing.updated_at = dt.datetime.utcnow()
                    session.add(existing)
                    updated += 1
            else:
                # Create new local event
                data = _google_event_to_schedule_data(g_event, member)
                new_event = ScheduleEvent(**data)
                session.add(new_event)
                imported += 1

        page_token = events_result.get("nextPageToken")
        if not page_token:
            break

    # --- Export to Google ---
    local_events = session.exec(
        select(ScheduleEvent).where(
            ScheduleEvent.household_id == HOUSEHOLD_ID,
            ScheduleEvent.google_event_id == None,  # noqa: E711
            ScheduleEvent.source != "google_calendar",
        )
    ).all()

    for event in local_events:
        # Only export events assigned to this member
        if member.id not in (event.assigned_member_ids or []):
            continue

        body = _schedule_event_to_google(event)
        created = service.events().insert(calendarId=calendar_id, body=body).execute()
        event.google_event_id = created["id"]
        session.add(event)
        exported += 1

    session.commit()
    return {"imported": imported, "exported": exported, "updated": updated}


def disconnect_member(member: Member, session: Session):
    """Remove Google Calendar credentials from a member."""
    member.google_calendar_id = None
    member.google_credentials = None
    session.add(member)
    session.commit()
