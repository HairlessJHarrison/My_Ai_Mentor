"""Achievement models — per-member reward cups with prize goals and optional renewal."""

import datetime as dt
from typing import Literal
from sqlmodel import SQLModel, Field


class AchievementBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    member_id: int = Field(description="Which family member is working toward this")
    prize_name: str = Field(description="Name of the prize/reward, e.g. 'New Bike'")
    target_points: int = Field(description="Points needed to claim the prize")
    prize_image_url: str | None = Field(default=None, description="Optional image URL for the prize")
    is_active: bool = Field(default=True, description="Whether this achievement is currently active")
    is_claimed: bool = Field(default=False, description="Whether the prize has been claimed")
    claimed_at: dt.datetime | None = Field(default=None, description="When the prize was last claimed")
    renewable: bool = Field(default=False, description="If true, resets progress after claiming so it can be earned again")
    renewal_period: str | None = Field(default=None, description="Hint for renewal cadence: weekly, monthly, quarterly")
    claim_count: int = Field(default=0, description="How many times this achievement has been claimed")


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
    renewable: bool = Field(default=False, description="Whether this achievement can be claimed multiple times")
    renewal_period: Literal["weekly", "monthly", "quarterly"] | None = Field(default=None, description="Renewal cadence hint")


class AchievementUpdate(SQLModel):
    prize_name: str | None = None
    target_points: int | None = None
    prize_image_url: str | None = None
    is_active: bool | None = None
    renewable: bool | None = None
    renewal_period: Literal["weekly", "monthly", "quarterly"] | None = None


class AchievementClaim(SQLModel, table=True):
    """History record for each time an achievement is claimed."""
    __tablename__ = "achievement_claims"

    id: int | None = Field(default=None, primary_key=True)
    achievement_id: int = Field(description="Which achievement was claimed", index=True)
    household_id: str = Field(description="Household identifier")
    member_id: int = Field(description="Who claimed it")
    claimed_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    points_at_claim: int = Field(default=0, description="Points earned at time of claim")
