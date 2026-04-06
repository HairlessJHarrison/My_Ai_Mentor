"""KioskSettings model — display kiosk and screensaver configuration."""

import datetime as dt
from sqlmodel import SQLModel, Field


class KioskSettingsBase(SQLModel):
    household_id: str = Field(unique=True, description="Household identifier")
    enabled: bool = Field(default=False, description="Whether kiosk mode is active")
    auto_fullscreen: bool = Field(default=False, description="Auto-enter fullscreen on startup")
    idle_timeout_seconds: int = Field(default=120, description="Seconds of inactivity before screensaver; 0 = never")
    family_name: str = Field(default="Our Family", description="Family name shown on screensaver clock")


class KioskSettings(KioskSettingsBase, table=True):
    __tablename__ = "kiosk_settings"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))
    updated_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


class KioskSettingsUpdate(SQLModel):
    enabled: bool | None = None
    auto_fullscreen: bool | None = None
    idle_timeout_seconds: int | None = None
    family_name: str | None = None
