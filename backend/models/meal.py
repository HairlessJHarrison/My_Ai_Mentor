import datetime as dt
from typing import Literal
from sqlalchemy import String
from sqlmodel import SQLModel, Field, Column, JSON, Relationship


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
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))
    updated_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


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


# ---------------------------------------------------------------------------
# Meal History — tracks what was actually cooked
# ---------------------------------------------------------------------------

class MealHistory(SQLModel, table=True):
    __tablename__ = "meal_history"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(index=True)
    meal_plan_id: int | None = Field(default=None, description="Source meal plan, if any")
    recipe_id: int | None = Field(default=None, description="Future Recipe FK placeholder")
    recipe_name: str
    date: dt.date = Field(index=True)
    meal_type: str = Field(sa_column=Column(String))
    cooked_by: int | None = Field(default=None, description="member_id of who cooked")
    notes: str | None = Field(default=None)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


class MealHistoryCreate(SQLModel):
    household_id: str = "default"
    meal_plan_id: int | None = None
    recipe_id: int | None = None
    recipe_name: str
    date: dt.date
    meal_type: str
    cooked_by: int | None = None
    notes: str | None = None


# ---------------------------------------------------------------------------
# Shopping List
# ---------------------------------------------------------------------------

class ShoppingList(SQLModel, table=True):
    __tablename__ = "shopping_lists"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(index=True)
    name: str
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


class ShoppingListItem(SQLModel, table=True):
    __tablename__ = "shopping_list_items"

    id: int | None = Field(default=None, primary_key=True)
    list_id: int = Field(foreign_key="shopping_lists.id", index=True)
    ingredient_name: str
    quantity: float | None = Field(default=None)
    unit: str | None = Field(default=None)
    checked: bool = Field(default=False)
    recipe_source: str | None = Field(default=None, description="Recipe name this ingredient came from")


class ShoppingListItemCreate(SQLModel):
    ingredient_name: str
    quantity: float | None = None
    unit: str | None = None
    recipe_source: str | None = None


class ShoppingListItemUpdate(SQLModel):
    checked: bool | None = None
    quantity: float | None = None
    unit: str | None = None


class ShoppingListGenerate(SQLModel):
    household_id: str = "default"
    name: str
    start_date: dt.date
    end_date: dt.date
