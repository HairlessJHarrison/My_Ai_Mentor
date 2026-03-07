import datetime as dt
from typing import Literal
from sqlalchemy import String
from sqlmodel import SQLModel, Field, Column, JSON


class MealPlanBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    date: dt.date = Field(description="Meal date", index=True)
    meal_type: str = Field(description="Type of meal: breakfast, lunch, dinner, snack", sa_column=Column(String))
    recipe_name: str = Field(description="Recipe title")
    ingredients: list[str] = Field(sa_column=Column(JSON), description="List of ingredients")
    est_cost: float = Field(description="Estimated cost in USD")
    health_score: int = Field(ge=1, le=10, description="Health rating from 1 (least healthy) to 10 (most healthy)")
    prep_time_min: int = Field(description="Preparation time in minutes")
    nutrition_data: dict | None = Field(default=None, sa_column=Column(JSON), description="Optional macros: {calories, protein_g, carbs_g, fat_g}")
    notes: str | None = Field(default=None, description="Additional notes or instructions")


class MealPlan(MealPlanBase, table=True):
    __tablename__ = "meal_plans"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class MealPlanCreate(MealPlanBase):
    pass


class MealPlanUpdate(SQLModel):
    date: dt.date | None = None
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"] | None = None
    recipe_name: str | None = None
    ingredients: list[str] | None = None
    est_cost: float | None = None
    health_score: int | None = Field(default=None, ge=1, le=10)
    prep_time_min: int | None = None
    nutrition_data: dict | None = None
    notes: str | None = None
