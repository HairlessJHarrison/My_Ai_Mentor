import datetime as dt
from sqlalchemy import String
from sqlmodel import SQLModel, Field, Column, JSON


class RecipeBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    name: str = Field(description="Recipe name", index=True)
    category: str | None = Field(
        default=None,
        sa_column=Column(String),
        description="Category: breakfast, lunch, dinner, snack, dessert, other",
    )
    ingredients: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON),
        description="List of ingredients",
    )
    instructions: str | None = Field(default=None, description="Cooking instructions")
    est_cost: float | None = Field(default=None, description="Estimated cost in USD")
    health_score: int | None = Field(default=None, ge=1, le=10, description="Health rating 1-10")
    prep_time_min: int | None = Field(default=None, description="Prep time in minutes")
    nutrition_data: dict | None = Field(
        default=None,
        sa_column=Column(JSON),
        description="Optional macros: {calories, protein_g, carbs_g, fat_g}",
    )
    notes: str | None = Field(default=None, description="Additional notes")


class Recipe(RecipeBase, table=True):
    __tablename__ = "recipes"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))
    updated_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


class RecipeCreate(RecipeBase):
    pass


class RecipeUpdate(SQLModel):
    name: str | None = None
    category: str | None = None
    ingredients: list[str] | None = None
    instructions: str | None = None
    est_cost: float | None = None
    health_score: int | None = Field(default=None, ge=1, le=10)
    prep_time_min: int | None = None
    nutrition_data: dict | None = None
    notes: str | None = None
