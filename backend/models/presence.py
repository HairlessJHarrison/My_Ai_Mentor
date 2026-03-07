import datetime as dt
from typing import Literal
from sqlalchemy import String
from sqlmodel import SQLModel, Field, Column, JSON


class PresenceSessionBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    planned_duration_min: int = Field(description="Intended duration in minutes")
    suggested_activity: str | None = Field(default=None, description="Activity suggestion shown on the unplugged screen")


class PresenceSession(PresenceSessionBase, table=True):
    __tablename__ = "presence_sessions"

    id: int | None = Field(default=None, primary_key=True)
    start_time: dt.datetime = Field(default_factory=dt.datetime.utcnow, description="When unplugged session started")
    end_time: dt.datetime | None = Field(default=None, description="When unplugged session ended, null if active")
    status: str = Field(default="active", description="Session status: active, completed, cancelled", sa_column=Column(String))
    participant_devices: list[str] = Field(default=[], sa_column=Column(JSON), description="Devices that entered unplugged mode")
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class PresenceSessionCreate(SQLModel):
    planned_duration_min: int = Field(description="Intended duration in minutes")
    suggested_activity: str | None = Field(default=None, description="Activity suggestion shown on the unplugged screen")
