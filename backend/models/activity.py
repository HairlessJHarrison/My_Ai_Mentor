import datetime as dt
from typing import Literal
from sqlalchemy import String
from sqlmodel import SQLModel, Field, Column, JSON


class ActivityBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    date: dt.date = Field(description="Activity date", index=True)
    activity_type: str = Field(description="Type of scored activity: screen_free_family, outdoor, shared_meal, game_creative, one_on_one, other", sa_column=Column(String))
    duration_min: int = Field(description="Duration of activity in minutes")
    participants_count: int = Field(ge=1, description="Number of household members who participated")
    participant_member_ids: list[int] = Field(default=[], sa_column=Column(JSON), description="Member IDs of participants (for per-member scoring)")
    details: dict | None = Field(default=None, sa_column=Column(JSON), description="Freeform details about the activity")
    source: str = Field(default="manual", description="How this activity was logged: manual, openclaw", sa_column=Column(String))


class Activity(ActivityBase, table=True):
    __tablename__ = "activities"

    id: int | None = Field(default=None, primary_key=True)
    points_earned: int = Field(default=0, description="Calculated points (server-side based on scoring rules)")
    multipliers_applied: list[str] = Field(default=[], sa_column=Column(JSON), description="List of multiplier names that were applied")
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class ActivityCreate(SQLModel):
    activity_type: Literal["screen_free_family", "outdoor", "shared_meal", "game_creative", "one_on_one", "other"] = Field(description="Type of scored activity")
    duration_min: int = Field(description="Duration of activity in minutes")
    participants_count: int = Field(ge=1, description="Number of household members who participated")
    participant_member_ids: list[int] = Field(default=[], description="Member IDs of participants (for per-member scoring). If empty, points are awarded at household level.")
    details: dict | None = Field(default=None, description="Freeform details about the activity")
