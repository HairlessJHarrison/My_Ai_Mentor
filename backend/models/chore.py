"""Chore models — household chores with configurable points and assignments."""

import datetime as dt
from typing import Literal
from sqlalchemy import String
from sqlmodel import SQLModel, Field, Column, JSON


class ChoreBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    title: str = Field(description="Chore name, e.g. 'Make bed', 'Wash dishes', 'Take out trash'")
    points: int = Field(description="Points earned for completing this chore")
    assigned_member_ids: list[int] = Field(default=[], sa_column=Column(JSON), description="Member IDs this chore is assigned to (empty = anyone)")
    frequency: str = Field(default="daily", description="How often this chore resets: daily, weekly, as_needed", sa_column=Column(String))
    is_active: bool = Field(default=True, description="Whether this chore is currently active")


class Chore(ChoreBase, table=True):
    __tablename__ = "chores"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class ChoreCreate(SQLModel):
    household_id: str = Field(description="Household identifier")
    title: str = Field(description="Chore name")
    points: int = Field(description="Points earned for completing this chore")
    assigned_member_ids: list[int] = Field(default=[], description="Member IDs this chore is assigned to")
    frequency: Literal["daily", "weekly", "as_needed"] = Field(default="daily", description="How often this chore resets")


class ChoreUpdate(SQLModel):
    title: str | None = None
    points: int | None = None
    assigned_member_ids: list[int] | None = None
    frequency: Literal["daily", "weekly", "as_needed"] | None = None
    is_active: bool | None = None


class ChoreCompletion(SQLModel, table=True):
    __tablename__ = "chore_completions"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier")
    chore_id: int = Field(description="Which chore was completed")
    member_id: int = Field(description="Who completed it")
    date: dt.date = Field(description="Date of completion", index=True)
    verified_by: int | None = Field(default=None, description="Parent member_id who verified (optional)")
    points_earned: int = Field(default=0, description="Points earned")
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class ChoreCompleteRequest(SQLModel):
    chore_id: int = Field(description="Which chore was completed")
    member_id: int = Field(description="Who completed it")
