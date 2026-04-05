"""Personal goal models — custom goals and completions for individual members."""

import datetime as dt
from typing import Literal
from sqlalchemy import String
from sqlmodel import SQLModel, Field, Column


class PersonalGoalBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    member_id: int = Field(description="Which family member owns this goal")
    title: str = Field(description="Goal title, e.g. 'Practice piano', 'Read 30 minutes', 'Run 1 mile'")
    category: str = Field(description="Goal category: learning, fitness, creativity, mindfulness, health, other", sa_column=Column(String))
    target_frequency: str = Field(default="daily", description="How often: daily, weekdays, weekly, custom", sa_column=Column(String))
    points_per_completion: int = Field(default=10, description="Points earned each time this goal is completed")
    is_active: bool = Field(default=True, description="Whether this goal is currently being tracked")


class PersonalGoal(PersonalGoalBase, table=True):
    __tablename__ = "personal_goals"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


class PersonalGoalCreate(SQLModel):
    household_id: str = Field(description="Household identifier")
    member_id: int = Field(description="Which family member owns this goal")
    title: str = Field(description="Goal title")
    category: Literal["learning", "fitness", "creativity", "mindfulness", "health", "other"] = Field(description="Goal category")
    target_frequency: Literal["daily", "weekdays", "weekly", "custom"] = Field(default="daily", description="How often this goal should be completed")
    points_per_completion: int = Field(default=10, description="Points earned per completion")


class PersonalGoalUpdate(SQLModel):
    title: str | None = None
    category: Literal["learning", "fitness", "creativity", "mindfulness", "health", "other"] | None = None
    target_frequency: Literal["daily", "weekdays", "weekly", "custom"] | None = None
    points_per_completion: int | None = None
    is_active: bool | None = None


class GoalCompletion(SQLModel, table=True):
    __tablename__ = "goal_completions"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier")
    goal_id: int = Field(description="Which goal was completed")
    member_id: int = Field(description="Who completed it")
    date: dt.date = Field(description="Date of completion", index=True)
    duration_min: int | None = Field(default=None, description="Optional duration in minutes")
    notes: str | None = Field(default=None, description="Optional notes about the completion")
    points_earned: int = Field(default=0, description="Points earned (from goal config + any multipliers)")
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


class GoalCompleteRequest(SQLModel):
    goal_id: int = Field(description="Which goal was completed")
    member_id: int = Field(description="Who completed it")
    duration_min: int | None = Field(default=None, description="Optional duration in minutes")
    notes: str | None = Field(default=None, description="Optional notes")
