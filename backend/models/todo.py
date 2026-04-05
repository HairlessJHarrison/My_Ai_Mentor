"""To-do item models — simple one-off tasks with optional priority, due date, and assignment."""

import datetime as dt
from typing import Literal
from sqlalchemy import String
from sqlmodel import SQLModel, Field, Column


class TodoItemBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    title: str = Field(description="To-do item text, e.g. 'Call dentist', 'Buy birthday gift'")
    description: str | None = Field(default=None, description="Optional longer description or notes")
    priority: str = Field(default="medium", description="Priority level: low, medium, high", sa_column=Column(String))
    due_date: dt.date | None = Field(default=None, description="Optional due date")
    assigned_member_id: int | None = Field(default=None, description="Member this to-do is assigned to (None = unassigned)")
    is_completed: bool = Field(default=False, description="Whether this to-do has been completed")
    completed_at: dt.datetime | None = Field(default=None, description="Timestamp when marked complete")


class TodoItem(TodoItemBase, table=True):
    __tablename__ = "todo_items"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


class TodoItemCreate(SQLModel):
    household_id: str = Field(description="Household identifier")
    title: str = Field(description="To-do item text")
    description: str | None = Field(default=None, description="Optional longer description")
    priority: Literal["low", "medium", "high"] = Field(default="medium", description="Priority level")
    due_date: dt.date | None = Field(default=None, description="Optional due date")
    assigned_member_id: int | None = Field(default=None, description="Member to assign this to-do to")


class TodoItemUpdate(SQLModel):
    title: str | None = None
    description: str | None = None
    priority: Literal["low", "medium", "high"] | None = None
    due_date: dt.date | None = None
    assigned_member_id: int | None = None
    is_completed: bool | None = None
