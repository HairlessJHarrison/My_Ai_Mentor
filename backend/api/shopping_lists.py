"""Shopping list management — generate from meal plans, CRUD, and item toggling."""

import datetime as dt
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.meal import (
    MealPlan,
    ShoppingList,
    ShoppingListGenerate,
    ShoppingListItem,
    ShoppingListItemCreate,
    ShoppingListItemUpdate,
)

router = APIRouter(prefix="/api/v1/shopping-lists", tags=["Meals"])

HOUSEHOLD_ID = "default"


@router.post("/generate", status_code=201)
async def generate_shopping_list(
    body: ShoppingListGenerate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Generate a shopping list by aggregating ingredients from meal plans in a date range."""
    stmt = select(MealPlan).where(
        MealPlan.household_id == body.household_id,
        MealPlan.date >= body.start_date,
        MealPlan.date <= body.end_date,
    )
    meals = session.exec(stmt).all()

    # Aggregate: (ingredient_lower, recipe_name) -> count occurrences
    # Key: (normalized_name) -> {count, recipe_sources}
    ingredient_map: dict[str, dict] = defaultdict(lambda: {"count": 0, "recipes": set()})
    for meal in meals:
        for ingredient in (meal.ingredients or []):
            normalized = ingredient.strip().lower()
            if not normalized:
                continue
            ingredient_map[normalized]["count"] += 1
            ingredient_map[normalized]["recipes"].add(meal.recipe_name)

    shopping_list = ShoppingList(
        household_id=body.household_id,
        name=body.name,
    )
    session.add(shopping_list)
    session.commit()
    session.refresh(shopping_list)

    items = []
    for ingredient_name, meta in sorted(ingredient_map.items()):
        item = ShoppingListItem(
            list_id=shopping_list.id,
            ingredient_name=ingredient_name,
            quantity=float(meta["count"]) if meta["count"] > 1 else None,
            recipe_source=", ".join(sorted(meta["recipes"])),
        )
        session.add(item)
        items.append(item)

    session.commit()
    for item in items:
        session.refresh(item)

    return {
        **shopping_list.model_dump(mode="json"),
        "items": [i.model_dump(mode="json") for i in items],
    }


@router.get("")
async def list_shopping_lists(
    household_id: str = Query(HOUSEHOLD_ID),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """List all shopping lists for the household."""
    stmt = select(ShoppingList).where(
        ShoppingList.household_id == household_id
    ).order_by(ShoppingList.created_at.desc())
    lists = session.exec(stmt).all()
    return {"lists": [sl.model_dump(mode="json") for sl in lists]}


@router.get("/{list_id}")
async def get_shopping_list(
    list_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Get a shopping list with all its items."""
    shopping_list = session.get(ShoppingList, list_id)
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found")

    stmt = select(ShoppingListItem).where(ShoppingListItem.list_id == list_id)
    items = session.exec(stmt).all()

    return {
        **shopping_list.model_dump(mode="json"),
        "items": [i.model_dump(mode="json") for i in items],
    }


@router.post("/{list_id}/items", status_code=201)
async def add_item(
    list_id: int,
    body: ShoppingListItemCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Manually add an item to a shopping list."""
    shopping_list = session.get(ShoppingList, list_id)
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found")

    item = ShoppingListItem(list_id=list_id, **body.model_dump())
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.put("/{list_id}/items/{item_id}")
async def update_item(
    list_id: int,
    item_id: int,
    body: ShoppingListItemUpdate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Toggle checked state or update quantity/unit on a shopping list item."""
    item = session.get(ShoppingListItem, item_id)
    if not item or item.list_id != list_id:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/{list_id}")
async def delete_shopping_list(
    list_id: int,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Delete a shopping list and all its items."""
    shopping_list = session.get(ShoppingList, list_id)
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found")

    # Delete items first
    items = session.exec(select(ShoppingListItem).where(ShoppingListItem.list_id == list_id)).all()
    for item in items:
        session.delete(item)

    session.delete(shopping_list)
    session.commit()
    return {"deleted": True}
