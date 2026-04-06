import datetime as dt
from typing import Literal
from sqlalchemy import String, UniqueConstraint
from sqlmodel import SQLModel, Field, Column


class MealRating(SQLModel, table=True):
    """One rating per member per recipe — upserted on create."""

    __tablename__ = "meal_ratings"
    __table_args__ = (UniqueConstraint("recipe_id", "member_id", name="uq_rating_recipe_member"),)

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(index=True)
    recipe_id: int = Field(index=True, description="References recipes.id")
    member_id: int = Field(index=True, description="References members.id")
    rating: int = Field(ge=1, le=5, description="Star rating 1-5")
    comment: str | None = Field(default=None)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


class MealRatingCreate(SQLModel):
    member_id: int
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class MemberPreference(SQLModel, table=True):
    """One preference per member per recipe — upserted on set."""

    __tablename__ = "member_preferences"
    __table_args__ = (UniqueConstraint("recipe_id", "member_id", name="uq_pref_recipe_member"),)

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(index=True)
    recipe_id: int = Field(index=True, description="References recipes.id")
    member_id: int = Field(index=True, description="References members.id")
    preference: str | None = Field(
        default=None,
        sa_column=Column(String),
        description="'loved', 'liked', 'disliked', or null (cleared)",
    )
    is_favorite: bool = Field(default=False)
    updated_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


class MemberPreferenceSet(SQLModel):
    member_id: int
    preference: Literal["loved", "liked", "disliked"] | None = None
