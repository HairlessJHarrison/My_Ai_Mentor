import datetime as dt
from sqlmodel import SQLModel, Field, Column, JSON


class RecipeBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    name: str = Field(description="Recipe name")
    description: str | None = Field(default=None, description="Brief description")
    category: str = Field(description="Meal category: breakfast, lunch, dinner, snack")
    prep_time_min: int = Field(default=0, description="Prep time in minutes")
    cook_time_min: int = Field(default=0, description="Cook time in minutes")
    servings: int = Field(default=4, description="Number of servings")
    instructions: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON),
        description="Step-by-step instructions",
    )
    photo_url: str | None = Field(default=None, description="Photo URL or path")


class Recipe(RecipeBase, table=True):
    __tablename__ = "recipes"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))
    updated_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


class RecipeCreate(RecipeBase):
    ingredients: list[dict] = Field(
        default_factory=list,
        description="List of {ingredient_name, quantity, unit, order}",
    )


class RecipeUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    prep_time_min: int | None = None
    cook_time_min: int | None = None
    servings: int | None = None
    instructions: list[str] | None = None
    photo_url: str | None = None
    ingredients: list[dict] | None = None


class RecipeIngredientBase(SQLModel):
    recipe_id: int = Field(foreign_key="recipes.id", description="Parent recipe")
    ingredient_name: str = Field(description="Ingredient name")
    quantity: float = Field(default=1.0, description="Amount")
    unit: str = Field(default="", description="Unit of measure, e.g. cups, tbsp, oz")
    order: int = Field(default=0, description="Display order")


class RecipeIngredient(RecipeIngredientBase, table=True):
    __tablename__ = "recipe_ingredients"

    id: int | None = Field(default=None, primary_key=True)
