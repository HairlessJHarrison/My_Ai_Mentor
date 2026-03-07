"""Meal module — CRUD for meal plans, grocery list aggregation."""

import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.meal import MealPlan, MealPlanCreate, MealPlanUpdate
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
    meal.updated_at = dt.datetime.utcnow()

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
