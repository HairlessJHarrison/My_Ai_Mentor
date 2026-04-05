"""Achievement models — per-member reward cups with prize goals."""

import datetime as dt
from sqlmodel import SQLModel, Field


class AchievementBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    member_id: int = Field(description="Which family member is working toward this")
    prize_name: str = Field(description="Name of the prize/reward, e.g. 'New Bike'")
    target_points: int = Field(description="Points needed to claim the prize")
    prize_image_url: str | None = Field(default=None, description="Optional image URL for the prize")
    is_active: bool = Field(default=True, description="Whether this achievement is currently active")
    is_claimed: bool = Field(default=False, description="Whether the prize has been claimed")
    claimed_at: dt.datetime | None = Field(default=None, description="When the prize was claimed")


class Achievement(AchievementBase, table=True):
    __tablename__ = "achievements"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


class AchievementCreate(SQLModel):
    household_id: str = Field(description="Household identifier")
    member_id: int = Field(description="Which family member is working toward this")
    prize_name: str = Field(description="Name of the prize/reward")
    target_points: int = Field(description="Points needed to claim the prize")
    prize_image_url: str | None = Field(default=None, description="Optional image URL")


class AchievementUpdate(SQLModel):
    prize_name: str | None = None
    target_points: int | None = None
    prize_image_url: str | None = None
    is_active: bool | None = None
