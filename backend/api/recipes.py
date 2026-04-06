"""Recipes module — CRUD for saved recipes, URL-based import, per-member ratings, preferences, and favorites."""

import datetime as dt
import json
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.recipe import Recipe, RecipeCreate, RecipeIngredient, RecipeUpdate
from models.recipe_rating import MealRating, MealRatingCreate, MemberPreference, MemberPreferenceSet
from websocket import manager

logger = logging.getLogger("unplugged.recipes")

router = APIRouter(prefix="/api/v1/recipes", tags=["Recipes"])

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


def _build_recipe_response(recipe: Recipe, session: Session) -> dict:
    """Return recipe dict with nested ingredients list."""
    data = recipe.model_dump(mode="json")
    stmt = select(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe.id).order_by(RecipeIngredient.order)
    data["ingredients"] = [i.model_dump(mode="json") for i in session.exec(stmt).all()]
    return data


def _replace_ingredients(recipe_id: int, ingredients: list[dict], session: Session) -> None:
    """Delete existing ingredients for recipe and insert new ones."""
    existing = session.exec(
        select(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe_id)
    ).all()
    for ing in existing:
        session.delete(ing)
    session.flush()
    for order, item in enumerate(ingredients):
        ri = RecipeIngredient(
            recipe_id=recipe_id,
            ingredient_name=item.get("ingredient_name", ""),
            quantity=float(item.get("quantity", 1)),
            unit=item.get("unit", ""),
            order=item.get("order", order),
        )
        session.add(ri)


# IMPORTANT: /favorites and /import-url must be declared before /{recipe_id} routes so FastAPI
# doesn't interpret them as integer IDs.

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
    recipe_map = {r.id: _build_recipe_response(r, session) for r in recipes}
    return [recipe_map[rid] for rid in recipe_ids if rid in recipe_map]


@router.get("")
async def list_recipes(
    category: str | None = Query(None, description="Filter by category"),
    ingredient: str | None = Query(None, description="Search by ingredient name"),
    name: str | None = Query(None, description="Search by recipe name"),
    search: Optional[str] = Query(None, description="Filter by name (case-insensitive contains)"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """List all recipes for the household with optional filters."""
    stmt = select(Recipe).where(Recipe.household_id == HOUSEHOLD_ID)
    if category:
        stmt = stmt.where(Recipe.category == category)
    if name:
        stmt = stmt.where(Recipe.name.ilike(f"%{name}%"))
    recipes = session.exec(stmt).all()

    # Handle search param as alias for name filter
    if search and not name:
        search_lower = search.lower()
        recipes = [r for r in recipes if search_lower in r.name.lower()]

    # Ingredient search requires fetching ingredients
    if ingredient:
        filtered = []
        for r in recipes:
            ings = session.exec(
                select(RecipeIngredient).where(RecipeIngredient.recipe_id == r.id)
            ).all()
            if any(ingredient.lower() in i.ingredient_name.lower() for i in ings):
                filtered.append(r)
        recipes = filtered

    return [_build_recipe_response(r, session) for r in recipes]


@router.post("", status_code=201)
async def create_recipe(
    body: RecipeCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Create a recipe with nested ingredients."""
    recipe = Recipe.model_validate(body, update={"household_id": body.household_id or HOUSEHOLD_ID})
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    _replace_ingredients(recipe.id, body.ingredients, session)
    session.commit()
    session.refresh(recipe)
    data = _build_recipe_response(recipe, session)
    await manager.broadcast("recipe_changed", data)
    return data


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
        return _build_recipe_response(existing, session)
    recipe = Recipe.model_validate(body, update={"household_id": body.household_id or HOUSEHOLD_ID})
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    _replace_ingredients(recipe.id, body.ingredients, session)
    session.commit()
    data = _build_recipe_response(recipe, session)
    return data


@router.post("/import-url")
async def import_from_url(
    body: dict,
    _auth: str = Depends(verify_api_key),
):
    """
    Fetch a recipe URL and extract structured data.
    Tries JSON-LD Schema.org first, falls back to basic HTML parsing.
    Returns a pre-filled recipe object for the user to review before saving.
    """
    url = body.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=422, detail="url is required")

    try:
        import requests
        from bs4 import BeautifulSoup
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="requests and beautifulsoup4 must be installed for URL import",
        )

    try:
        resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0 (compatible; UnpluggedBot/1.0)"})
        resp.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to fetch URL: {exc}")

    soup = BeautifulSoup(resp.text, "html.parser")

    # --- Try JSON-LD first ---
    recipe_data = None
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            ld = json.loads(script.string or "")
            # Unwrap @graph if present
            if isinstance(ld, dict) and "@graph" in ld:
                candidates = ld["@graph"]
            elif isinstance(ld, list):
                candidates = ld
            else:
                candidates = [ld]
            for item in candidates:
                if isinstance(item, dict) and item.get("@type") in ("Recipe", "https://schema.org/Recipe"):
                    recipe_data = item
                    break
        except Exception:
            continue
        if recipe_data:
            break

    if recipe_data:
        return _parse_schema_recipe(recipe_data)

    # --- Fallback: basic HTML heuristics ---
    return _parse_html_fallback(soup, url)


@router.get("/{recipe_id}")
async def get_recipe(
    recipe_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Get a single recipe with ingredients."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe or recipe.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return _build_recipe_response(recipe, session)


@router.put("/{recipe_id}")
async def update_recipe(
    recipe_id: int,
    body: RecipeUpdate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Update a recipe and its ingredients."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe or recipe.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Recipe not found")

    update_data = body.model_dump(exclude_unset=True)
    ingredients = update_data.pop("ingredients", None)
    for key, value in update_data.items():
        setattr(recipe, key, value)
    recipe.updated_at = dt.datetime.now(dt.timezone.utc)

    session.add(recipe)
    session.commit()
    session.refresh(recipe)

    if ingredients is not None:
        _replace_ingredients(recipe.id, ingredients, session)
        session.commit()

    data = _build_recipe_response(recipe, session)
    await manager.broadcast("recipe_changed", data)
    return data


@router.delete("/{recipe_id}")
async def delete_recipe(
    recipe_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Delete a recipe, its ingredients, ratings, and preferences."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe or recipe.household_id != HOUSEHOLD_ID:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Delete ingredients first
    ings = session.exec(
        select(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe_id)
    ).all()
    for ing in ings:
        session.delete(ing)

    # Cascade-delete ratings and preferences
    for rating in session.exec(select(MealRating).where(MealRating.recipe_id == recipe_id)).all():
        session.delete(rating)
    for pref in session.exec(select(MemberPreference).where(MemberPreference.recipe_id == recipe_id)).all():
        session.delete(pref)

    session.delete(recipe)
    session.commit()
    await manager.broadcast("recipe_changed", {"id": recipe_id, "deleted": True})
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


# ---------------------------------------------------------------------------
# URL Import helpers
# ---------------------------------------------------------------------------

def _parse_schema_recipe(data: dict) -> dict:
    """Convert Schema.org Recipe JSON-LD into our pre-fill format."""
    def _first(val):
        if isinstance(val, list):
            return val[0] if val else ""
        return val or ""

    def _text(val):
        v = _first(val)
        if isinstance(v, dict):
            return v.get("text", "") or v.get("name", "")
        return str(v)

    name = _text(data.get("name", ""))
    description = _text(data.get("description", ""))
    category = _infer_category(data)
    prep_time_min = _parse_duration(data.get("prepTime", ""))
    cook_time_min = _parse_duration(data.get("cookTime", ""))
    servings = _parse_servings(data.get("recipeYield", data.get("yield", 4)))
    photo_url = _parse_photo(data.get("image", ""))

    raw_instructions = data.get("recipeInstructions", [])
    instructions = _parse_instructions(raw_instructions)

    raw_ingredients = data.get("recipeIngredient", [])
    ingredients = _parse_ingredients(raw_ingredients)

    return {
        "name": name,
        "description": description,
        "category": category,
        "prep_time_min": prep_time_min,
        "cook_time_min": cook_time_min,
        "servings": servings,
        "instructions": instructions,
        "photo_url": photo_url,
        "ingredients": ingredients,
        "_source": "json-ld",
    }


def _parse_html_fallback(soup, url: str) -> dict:
    """Best-effort extraction from plain HTML."""
    name = ""
    for sel in ["h1", '[class*="recipe-title"]', '[class*="recipe_title"]', '[itemprop="name"]']:
        tag = soup.select_one(sel)
        if tag:
            name = tag.get_text(strip=True)
            break

    description = ""
    meta = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
    if meta:
        description = meta.get("content", "")

    return {
        "name": name or "Imported Recipe",
        "description": description,
        "category": "dinner",
        "prep_time_min": 0,
        "cook_time_min": 0,
        "servings": 4,
        "instructions": [],
        "photo_url": None,
        "ingredients": [],
        "_source": "html-fallback",
        "_note": "Could not find structured recipe data. Please fill in details manually.",
    }


def _infer_category(data: dict) -> str:
    cats = []
    for field in ("recipeCategory", "mealType", "courseType"):
        v = data.get(field, "")
        if isinstance(v, list):
            cats.extend(v)
        elif v:
            cats.append(str(v))
    combined = " ".join(cats).lower()
    for cat in ("breakfast", "lunch", "snack"):
        if cat in combined:
            return cat
    return "dinner"


def _parse_duration(iso: str) -> int:
    """Parse ISO 8601 duration (PT30M, PT1H, PT1H30M) to minutes."""
    if not iso:
        return 0
    import re
    h = re.search(r"(\d+)H", iso)
    m = re.search(r"(\d+)M", iso)
    hours = int(h.group(1)) if h else 0
    mins = int(m.group(1)) if m else 0
    return hours * 60 + mins


def _parse_servings(val) -> int:
    if isinstance(val, int):
        return val
    if isinstance(val, list):
        val = val[0] if val else 4
    try:
        import re
        m = re.search(r"\d+", str(val))
        return int(m.group()) if m else 4
    except Exception:
        return 4


def _parse_photo(val) -> str | None:
    if not val:
        return None
    if isinstance(val, str):
        return val
    if isinstance(val, list):
        first = val[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict):
            return first.get("url") or first.get("contentUrl")
    if isinstance(val, dict):
        return val.get("url") or val.get("contentUrl")
    return None


def _parse_instructions(raw) -> list[str]:
    steps = []
    if isinstance(raw, str):
        return [raw.strip()] if raw.strip() else []
    for item in raw:
        if isinstance(item, str):
            steps.append(item.strip())
        elif isinstance(item, dict):
            text = item.get("text", "") or item.get("name", "")
            if text:
                steps.append(text.strip())
            # HowToSection — recurse into itemListElement
            for sub in item.get("itemListElement", []):
                if isinstance(sub, dict):
                    t = sub.get("text", "") or sub.get("name", "")
                    if t:
                        steps.append(t.strip())
    return [s for s in steps if s]


def _parse_ingredients(raw) -> list[dict]:
    import re
    from fractions import Fraction
    UNITS = [
        "cups", "cup", "tbsp", "tablespoon", "tablespoons",
        "tsp", "teaspoon", "teaspoons", "oz", "ounce", "ounces",
        "lb", "lbs", "pound", "pounds", "g", "gram", "grams",
        "kg", "ml", "liter", "liters", "l", "pint", "quart",
        "cloves", "clove", "can", "cans", "slice", "slices",
        "piece", "pieces", "bunch", "handfuls", "handful",
    ]
    unit_pattern = "|".join(re.escape(u) for u in sorted(UNITS, key=len, reverse=True))
    result = []
    for i, item in enumerate(raw):
        text = item if isinstance(item, str) else item.get("text", str(item))
        text = text.strip()
        qty = 1.0
        unit = ""
        name = text

        m = re.match(
            rf"^([\d\s½⅓⅔¼¾⅛⅜⅝⅞/\.]+)\s*({unit_pattern})s?\b\s*(.*)",
            text,
            re.IGNORECASE,
        )
        if m:
            raw_qty, unit, name = m.group(1).strip(), m.group(2).lower(), m.group(3).strip()
            try:
                qty = float(sum(float(Fraction(p)) for p in raw_qty.split()))
            except Exception:
                try:
                    qty = float(raw_qty)
                except Exception:
                    qty = 1.0
        else:
            # Try just a leading number
            m2 = re.match(r"^([\d½⅓⅔¼¾⅛⅜⅝⅞/\.]+)\s+(.*)", text)
            if m2:
                try:
                    qty = float(Fraction(m2.group(1)))
                    name = m2.group(2).strip()
                except Exception:
                    pass

        result.append({
            "ingredient_name": name or text,
            "quantity": qty,
            "unit": unit,
            "order": i,
        })
    return result
