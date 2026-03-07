import datetime as dt
from sqlmodel import SQLModel, Field, Column, JSON


class HouseholdConfigBase(SQLModel):
    household_id: str = Field(unique=True, description="Household identifier")
    household_name: str = Field(description="Display name for the household")
    members: list[dict] = Field(default=[], sa_column=Column(JSON), description="List of {name, role, dietary_restrictions[]}")
    health_goals: list[str] = Field(default=[], sa_column=Column(JSON), description="Household health goals: lower_sodium, high_protein, etc.")
    dietary_restrictions: list[str] = Field(default=[], sa_column=Column(JSON), description="Allergies and restrictions: gluten_free, nut_free, vegan, etc.")
    preferences: dict = Field(default={}, sa_column=Column(JSON), description="Freeform preferences: {favorite_cuisines[], default_meal_budget, etc.}")
    weekly_reflection_narrative: str | None = Field(default=None, description="Latest weekly narrative written by OpenClaw")


class HouseholdConfig(HouseholdConfigBase, table=True):
    __tablename__ = "household_config"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class HouseholdConfigUpdate(SQLModel):
    household_name: str | None = None
    members: list[dict] | None = None
    health_goals: list[str] | None = None
    dietary_restrictions: list[str] | None = None
    preferences: dict | None = None
    weekly_reflection_narrative: str | None = None
