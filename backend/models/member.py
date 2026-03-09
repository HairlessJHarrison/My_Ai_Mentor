"""Member model — structured family member profiles."""

import datetime as dt
from typing import Literal
from sqlalchemy import JSON, String
from sqlmodel import SQLModel, Field, Column


class MemberBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    name: str = Field(description="Display name")
    role: str = Field(description="Role in the household: parent, child", sa_column=Column(String))
    age: int | None = Field(default=None, description="Age of the member")
    color: str = Field(default="#22c55e", description="Hex color for calendar/UI display")
    avatar: str | None = Field(default=None, description="Avatar image URL or emoji")
    google_calendar_id: str | None = Field(default=None, description="Google Calendar ID for sync")
    google_credentials: dict | None = Field(default=None, sa_column=Column(JSON), description="Google OAuth2 credentials")


class Member(MemberBase, table=True):
    __tablename__ = "members"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class MemberCreate(SQLModel):
    household_id: str = Field(description="Household identifier")
    name: str = Field(description="Display name")
    role: Literal["parent", "child"] = Field(description="Role in the household")
    age: int | None = Field(default=None, description="Age of the member")
    color: str = Field(default="#22c55e", description="Hex color for calendar/UI display")
    avatar: str | None = Field(default=None, description="Avatar image URL or emoji")


class MemberUpdate(SQLModel):
    name: str | None = None
    role: Literal["parent", "child"] | None = None
    age: int | None = None
    color: str | None = None
    avatar: str | None = None
    google_calendar_id: str | None = None
