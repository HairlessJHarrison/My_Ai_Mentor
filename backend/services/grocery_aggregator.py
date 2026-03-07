"""Grocery aggregator — consolidates meal plan ingredients into a shopping list."""

from models.meal import MealPlan


def aggregate_grocery_list(meals: list[MealPlan]) -> dict:
    """Deduplicate and aggregate ingredients from a list of meal plans.

    Returns: {items: [{ingredient, quantity_needed, est_cost}], total_est_cost: float}
    """
    ingredient_map: dict[str, dict] = {}

    for meal in meals:
        per_ingredient_cost = (
            meal.est_cost / len(meal.ingredients) if meal.ingredients else 0
        )
        for ingredient in meal.ingredients or []:
            key = ingredient.strip().lower()
            if key in ingredient_map:
                ingredient_map[key]["quantity_needed"] += 1
                ingredient_map[key]["est_cost"] += per_ingredient_cost
            else:
                ingredient_map[key] = {
                    "ingredient": ingredient.strip(),
                    "quantity_needed": 1,
                    "est_cost": round(per_ingredient_cost, 2),
                }

    items = sorted(ingredient_map.values(), key=lambda x: x["ingredient"])
    for item in items:
        item["est_cost"] = round(item["est_cost"], 2)

    total = round(sum(item["est_cost"] for item in items), 2)
    return {"items": items, "total_est_cost": total}
