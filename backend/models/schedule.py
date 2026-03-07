import datetime as dt
from typing import Literal
from sqlalchemy import String
from sqlmodel import SQLModel, Field, Column, JSON


class ScheduleEventBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    date: dt.date = Field(description="Event date", index=True)
    start_time: dt.time = Field(description="Event start time")
    end_time: dt.time = Field(description="Event end time")
    title: str = Field(description="Event title")
    event_type: str = Field(description="Category of event: appointment, work, school, social, errand, protected_time, other", sa_column=Column(String))
    is_protected: bool = Field(default=False, description="Whether this is a protected screen-free block")
    participants: list[str] = Field(default=[], sa_column=Column(JSON), description="List of household members involved")
    recurrence_rule: dict | None = Field(default=None, sa_column=Column(JSON), description="iCal RRULE as JSON, null if one-time")
    source: str = Field(default="manual", description="How this event was created: manual, caldav_import, openclaw", sa_column=Column(String))


class ScheduleEvent(ScheduleEventBase, table=True):
    __tablename__ = "schedules"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class ScheduleEventCreate(ScheduleEventBase):
    pass


class ScheduleEventUpdate(SQLModel):
    date: dt.date | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    title: str | None = None
    event_type: Literal["appointment", "work", "school", "social", "errand", "protected_time", "other"] | None = None
    is_protected: bool | None = None
    participants: list[str] | None = None
    recurrence_rule: dict | None = None
    source: Literal["manual", "caldav_import", "openclaw"] | None = None
