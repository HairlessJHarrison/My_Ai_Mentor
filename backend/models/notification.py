"""Notification models — in-app notifications and per-member reminder configuration."""

import datetime as dt

from sqlmodel import SQLModel, Field


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(index=True, description="Household identifier")
    member_id: int | None = Field(default=None, index=True, description="Which member this is for (None = all members)")
    message: str = Field(description="Notification message text")
    type: str = Field(default="info", description="Notification type: goal_reminder, achievement, info")
    read: bool = Field(default=False, description="Whether the member has read this notification")
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow, index=True)


class NotificationCreate(SQLModel):
    member_id: int | None = None
    message: str
    type: str = "info"


class ReminderConfig(SQLModel, table=True):
    __tablename__ = "reminder_configs"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(index=True, description="Household identifier")
    member_id: int | None = Field(default=None, index=True, description="Member ID, or None for the global default")
    reminder_hour: int = Field(default=18, ge=0, le=23, description="Hour of the day to send reminders (0–23)")
    reminder_minute: int = Field(default=0, ge=0, le=59, description="Minute of the hour to send reminders (0–59)")
    enabled: bool = Field(default=True, description="Whether reminders are enabled for this member/global")


class ReminderConfigUpdate(SQLModel):
    reminder_hour: int | None = Field(default=None, ge=0, le=23)
    reminder_minute: int | None = Field(default=None, ge=0, le=59)
    enabled: bool | None = None
