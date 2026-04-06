"""Recipes module — recipe CRUD, per-member ratings, preferences, and favorites."""

import datetime as dt
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.recipe import Recipe, RecipeCreate, RecipeUpdate
from models.recipe_rating import MealRating, MealRatingCreate, MemberPreference, MemberPreferenceSet
from websocket import manager

router = APIRouter(prefix="/api/v1/recipes", tags=["Recipes"])

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


# ---------------------------------------------------------------------------
# Recipe CRUD
# ---------------------------------------------------------------------------

@router.get("")
async def list_recipes(
    search: Optional[str] = Query(None, description="Filter by name (case-insensitive contains)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """List all recipes for the household."""
    stmt = select(Recipe).where(Recipe.household_id == HOUSEHOLD_ID)
    recipes = session.exec(stmt).all()
    if search:
        search_lower = search.lower()
        recipes = [r for r in recipes if search_lower in r.name.lower()]
    if category:
        recipes = [r for r in recipes if r.category == category]
    return [r.model_dump(mode="json") for r in recipes]


@router.post("", status_code=201)
async def create_recipe(
    body: RecipeCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Create a new recipe."""
    recipe = Recipe.model_validate(body, update={"household_id": body.household_id or HOUSEHOLD_ID})
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    return recipe.model_dump(mode="json")


@router.post("/find-or-create", status_code=200)
async def find_or_create_recipe(
    body: RecipeCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Find a recipe by name or create it if it doesn't exist. Used when linking meal plans."""
    existing = session.exec(
        select(Recipe).where(
            Recipe.household_id == HOUSEHOLD_ID,
            Recipe.name == body.name,
        )
    ).first()
    if existing:
        return existing.model_dump(mode="json")
    recipe = Recipe.model_validate(body, update={"household_id": body.household_id or HOUSEHOLD_ID})
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    return recipe.model_dump(mode="json")


# IMPORTANT: /favorites must be declared before /{recipe_id} routes so FastAPI
# doesn't interpret "favorites" as an integer ID.
@router.get("/favorites")
async def get_favorites(
    member_id: int = Query(..., description="Member whose favorites to retrieve"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Return all recipes that a member has marked as favorite."""
    prefs = session.exec(
        select(MemberPreference).where(
            MemberPreference.household_id == HOUSEHOLD_ID,
            MemberPreference.member_id == member_id,
            MemberPreference.is_favorite == True,
        )
    ).all()
    recipe_ids = [p.recipe_id for p in prefs]
    if not recipe_ids:
        return []
    recipes = session.exec(
        select(Recipe).where(Recipe.id.in_(recipe_ids))
    ).all()
    recipe_map = {r.id: r.model_dump(mode="json") for r in recipes}
    return [recipe_map[rid] for rid in recipe_ids if rid in recipe_map]


@router.get("/{recipe_id}")
async def get_recipe(
    recipe_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Get a single recipe by ID."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe or recipe.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe.model_dump(mode="json")


@router.put("/{recipe_id}")
async def update_recipe(
    recipe_id: int,
    body: RecipeUpdate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Update a recipe."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe or recipe.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Recipe not found")
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(recipe, key, value)
    recipe.updated_at = dt.datetime.now(dt.timezone.utc)
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    return recipe.model_dump(mode="json")


@router.delete("/{recipe_id}")
async def delete_recipe(
    recipe_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Delete a recipe and its ratings/preferences."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe or recipe.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Recipe not found")
    # Cascade-delete ratings and preferences
    for rating in session.exec(select(MealRating).where(MealRating.recipe_id == recipe_id)).all():
        session.delete(rating)
    for pref in session.exec(select(MemberPreference).where(MemberPreference.recipe_id == recipe_id)).all():
        session.delete(pref)
    session.delete(recipe)
    session.commit()
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Ratings
# ---------------------------------------------------------------------------

@router.post("/{recipe_id}/ratings", status_code=200)
async def upsert_rating(
    recipe_id: int,
    body: MealRatingCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Rate a recipe (one rating per member per recipe — upsert)."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe or recipe.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Recipe not found")

    existing = session.exec(
        select(MealRating).where(
            MealRating.recipe_id == recipe_id,
            MealRating.member_id == body.member_id,
        )
    ).first()

    if existing:
        existing.rating = body.rating
        existing.comment = body.comment
        existing.created_at = dt.datetime.now(dt.timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        result = existing
    else:
        rating = MealRating(
            household_id=HOUSEHOLD_ID,
            recipe_id=recipe_id,
            member_id=body.member_id,
            rating=body.rating,
            comment=body.comment,
        )
        session.add(rating)
        session.commit()
        session.refresh(rating)
        result = rating

    await manager.broadcast("recipe_rated", result.model_dump(mode="json"))
    return result.model_dump(mode="json")


@router.get("/{recipe_id}/ratings")
async def get_ratings(
    recipe_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Get all ratings for a recipe."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe or recipe.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Recipe not found")
    ratings = session.exec(
        select(MealRating).where(MealRating.recipe_id == recipe_id)
    ).all()
    return [r.model_dump(mode="json") for r in ratings]


@router.get("/{recipe_id}/ratings/summary")
async def get_ratings_summary(
    recipe_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Return average rating, count, and per-member breakdown."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe or recipe.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Recipe not found")
    ratings = session.exec(
        select(MealRating).where(MealRating.recipe_id == recipe_id)
    ).all()
    if not ratings:
        return {"recipe_id": recipe_id, "average": None, "count": 0, "by_member": []}
    avg = round(sum(r.rating for r in ratings) / len(ratings), 2)
    return {
        "recipe_id": recipe_id,
        "average": avg,
        "count": len(ratings),
        "by_member": [
            {"member_id": r.member_id, "rating": r.rating, "comment": r.comment}
            for r in ratings
        ],
    }


# ---------------------------------------------------------------------------
# Preferences
# ---------------------------------------------------------------------------

@router.put("/{recipe_id}/preferences")
async def set_preference(
    recipe_id: int,
    body: MemberPreferenceSet,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Set (or clear) a member's preference for a recipe."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe or recipe.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Recipe not found")

    existing = session.exec(
        select(MemberPreference).where(
            MemberPreference.recipe_id == recipe_id,
            MemberPreference.member_id == body.member_id,
        )
    ).first()

    if existing:
        existing.preference = body.preference
        existing.updated_at = dt.datetime.now(dt.timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        result = existing
    else:
        pref = MemberPreference(
            household_id=HOUSEHOLD_ID,
            recipe_id=recipe_id,
            member_id=body.member_id,
            preference=body.preference,
        )
        session.add(pref)
        session.commit()
        session.refresh(pref)
        result = pref

    await manager.broadcast("recipe_preference_changed", result.model_dump(mode="json"))
    return result.model_dump(mode="json")


@router.get("/{recipe_id}/preferences")
async def get_preferences(
    recipe_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Get all member preferences for a recipe."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe or recipe.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Recipe not found")
    prefs = session.exec(
        select(MemberPreference).where(MemberPreference.recipe_id == recipe_id)
    ).all()
    return [p.model_dump(mode="json") for p in prefs]


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------

@router.post("/{recipe_id}/favorite")
async def toggle_favorite(
    recipe_id: int,
    member_id: int = Query(..., description="Member toggling the favorite"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Toggle a recipe's favorite status for a member."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe or recipe.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Recipe not found")

    existing = session.exec(
        select(MemberPreference).where(
            MemberPreference.recipe_id == recipe_id,
            MemberPreference.member_id == member_id,
        )
    ).first()

    if existing:
        existing.is_favorite = not existing.is_favorite
        existing.updated_at = dt.datetime.now(dt.timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        result = existing
    else:
        pref = MemberPreference(
            household_id=HOUSEHOLD_ID,
            recipe_id=recipe_id,
            member_id=member_id,
            is_favorite=True,
        )
        session.add(pref)
        session.commit()
        session.refresh(pref)
        result = pref

    await manager.broadcast("recipe_favorite_changed", result.model_dump(mode="json"))
    return {"recipe_id": recipe_id, "member_id": member_id, "is_favorite": result.is_favorite}
