"""Meal module — CRUD for meal plans, meal history, suggestions, and grocery list aggregation."""

import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func, col

from auth import verify_api_key
from database import get_session
from models.meal import MealHistory, MealHistoryCreate, MealPlan, MealPlanCreate, MealPlanUpdate
from services.grocery_aggregator import aggregate_grocery_list
from websocket import manager

router = APIRouter(prefix="/api/v1/meals", tags=["Meals"])

HOUSEHOLD_ID = "default"


def _week_bounds(week: str | None, date_str: str | None) -> tuple[dt.date, dt.date]:
    """Return (start, end) date range for a query."""
    if date_str:
        d = dt.date.fromisoformat(date_str)
        return d, d
    today = dt.date.today()
    start = today - dt.timedelta(days=today.weekday())  # Monday
    end = start + dt.timedelta(days=6)
    return start, end


@router.get("/plan")
async def get_plan(
    week: Optional[str] = Query("current", description="'current' or ignored when date is set"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD for a specific date"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Get meal plan for current week or a specific date."""
    start, end = _week_bounds(week, date)
    stmt = select(MealPlan).where(MealPlan.date >= start, MealPlan.date <= end)
    meals = session.exec(stmt).all()

    meals_data = [m.model_dump(mode="json") for m in meals]
    total_cost = round(sum(m.est_cost for m in meals), 2)
    avg_health = round(sum(m.health_score for m in meals) / len(meals), 1) if meals else 0

    return {
        "meals": meals_data,
        "total_cost": total_cost,
        "avg_health_score": avg_health,
    }


@router.post("/plan", status_code=201)
async def create_plan(
    body: MealPlanCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Create a meal plan entry."""
    meal = MealPlan.model_validate(body, update={"household_id": body.household_id or HOUSEHOLD_ID})
    session.add(meal)
    session.commit()
    session.refresh(meal)
    await manager.broadcast("meal_plan_changed", meal.model_dump(mode="json"))
    return meal


@router.put("/plan/{meal_id}")
async def update_plan(
    meal_id: int,
    body: MealPlanUpdate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Update a meal plan entry."""
    meal = session.get(MealPlan, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Meal plan not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(meal, key, value)
    meal.updated_at = dt.datetime.now(dt.timezone.utc)

    session.add(meal)
    session.commit()
    session.refresh(meal)
    await manager.broadcast("meal_plan_changed", meal.model_dump(mode="json"))
    return meal


@router.delete("/plan/{meal_id}")
async def delete_plan(
    meal_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Delete a meal plan entry."""
    meal = session.get(MealPlan, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Meal plan not found")

    session.delete(meal)
    session.commit()
    await manager.broadcast("meal_plan_changed", {"id": meal_id, "deleted": True})
    return {"deleted": True}


@router.get("/grocery-list")
async def get_grocery_list(
    week: str = Query("current", description="'current' for this week"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Consolidated grocery list from all meal plans for the week."""
    start, end = _week_bounds(week, None)
    stmt = select(MealPlan).where(MealPlan.date >= start, MealPlan.date <= end)
    meals = session.exec(stmt).all()
    return aggregate_grocery_list(list(meals))


# ---------------------------------------------------------------------------
# Meal History
# ---------------------------------------------------------------------------

@router.post("/history", status_code=201)
async def log_meal_history(
    body: MealHistoryCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Log a meal that was actually cooked."""
    entry = MealHistory.model_validate(body)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    await manager.broadcast("meal_history_logged", entry.model_dump(mode="json"))
    return entry


@router.get("/history")
async def get_meal_history(
    household_id: str = Query(HOUSEHOLD_ID),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """List meal history, optionally filtered by date range."""
    stmt = select(MealHistory).where(MealHistory.household_id == household_id)
    if start_date:
        stmt = stmt.where(MealHistory.date >= dt.date.fromisoformat(start_date))
    if end_date:
        stmt = stmt.where(MealHistory.date <= dt.date.fromisoformat(end_date))
    stmt = stmt.order_by(MealHistory.date.desc())
    entries = session.exec(stmt).all()
    return {"history": [e.model_dump(mode="json") for e in entries]}


@router.post("/plan/{meal_id}/mark-cooked", status_code=201)
async def mark_plan_cooked(
    meal_id: int,
    cooked_by: Optional[int] = Query(None, description="member_id of who cooked"),
    notes: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Mark a planned meal as cooked — creates a MealHistory entry."""
    meal = session.get(MealPlan, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Meal plan not found")

    entry = MealHistory(
        household_id=meal.household_id,
        meal_plan_id=meal.id,
        recipe_name=meal.recipe_name,
        date=meal.date,
        meal_type=meal.meal_type,
        cooked_by=cooked_by,
        notes=notes,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    await manager.broadcast("meal_history_logged", entry.model_dump(mode="json"))
    return entry


# ---------------------------------------------------------------------------
# Meal Suggestions
# ---------------------------------------------------------------------------

@router.get("/suggestions")
async def get_meal_suggestions(
    member_ids: Optional[str] = Query(None, description="Comma-separated member IDs (unused until ratings exist)"),
    count: int = Query(5, ge=1, le=20),
    household_id: str = Query(HOUSEHOLD_ID),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Return recipe suggestions based on cooking history.

    Algorithm:
    1. Find distinct recipe names from MealHistory.
    2. Exclude recipes cooked in the last 7 days.
    3. Sort by longest time since last cooked (most overdue first).
    4. Return up to `count` results.
    5. If history is sparse, pad with recently planned (but not recently cooked) recipes.
    """
    today = dt.date.today()
    cutoff = today - dt.timedelta(days=7)

    # Get last-cooked date per recipe from history
    subq = (
        select(MealHistory.recipe_name, func.max(MealHistory.date).label("last_cooked"))
        .where(MealHistory.household_id == household_id)
        .group_by(MealHistory.recipe_name)
        .subquery()
    )

    # Recipes cooked at least once, excluding those cooked within 7 days
    stmt = (
        select(subq.c.recipe_name, subq.c.last_cooked)
        .where(subq.c.last_cooked <= cutoff)
        .order_by(subq.c.last_cooked.asc())
        .limit(count)
    )
    rows = session.exec(stmt).all()

    suggestions = [
        {"recipe_name": row[0], "last_cooked": str(row[1]), "source": "history"}
        for row in rows
    ]

    # Pad from MealPlan if not enough history
    if len(suggestions) < count:
        needed = count - len(suggestions)
        already_suggested = {s["recipe_name"].lower() for s in suggestions}

        recent_cooked_names_stmt = select(MealHistory.recipe_name).where(
            MealHistory.household_id == household_id,
            MealHistory.date > cutoff,
        )
        recently_cooked = {r.lower() for r in session.exec(recent_cooked_names_stmt).all()}

        plan_stmt = (
            select(MealPlan.recipe_name, func.max(MealPlan.date).label("last_planned"))
            .where(MealPlan.household_id == household_id)
            .group_by(MealPlan.recipe_name)
            .order_by(col("last_planned").asc())
        )
        for recipe_name, last_planned in session.exec(plan_stmt).all():
            if len(suggestions) >= count:
                break
            key = recipe_name.lower()
            if key in already_suggested or key in recently_cooked:
                continue
            suggestions.append({"recipe_name": recipe_name, "last_cooked": None, "source": "meal_plan"})
            already_suggested.add(key)

    return {"suggestions": suggestions}
