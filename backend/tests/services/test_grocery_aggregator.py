"""Tests for grocery_aggregator — pure functions, no DB needed."""

from models.meal import MealPlan
from services.grocery_aggregator import aggregate_grocery_list


def _meal(ingredients, est_cost=10.0):
    return MealPlan(
        household_id="default",
        date="2026-03-10",
        meal_type="dinner",
        recipe_name="test",
        ingredients=ingredients,
        est_cost=est_cost,
        health_score=5,
        prep_time_min=20,
    )


class TestAggregateGroceryList:
    def test_empty_meals(self):
        result = aggregate_grocery_list([])
        assert result["items"] == []
        assert result["total_est_cost"] == 0

    def test_single_meal(self):
        result = aggregate_grocery_list([_meal(["Eggs", "Cheese"], 10.0)])
        assert len(result["items"]) == 2
        assert result["total_est_cost"] == 10.0

    def test_deduplication_case_insensitive(self):
        meals = [
            _meal(["Eggs"], 5.0),
            _meal(["eggs"], 5.0),
        ]
        result = aggregate_grocery_list(meals)
        assert len(result["items"]) == 1
        assert result["items"][0]["quantity_needed"] == 2

    def test_cost_aggregation(self):
        # Meal with 2 ingredients at $10 => $5 each
        # Meal with 1 ingredient at $6 => $6
        meals = [
            _meal(["Eggs", "Cheese"], 10.0),
            _meal(["Eggs"], 6.0),
        ]
        result = aggregate_grocery_list(meals)
        eggs = [i for i in result["items"] if i["ingredient"].lower() == "eggs"][0]
        assert eggs["quantity_needed"] == 2
        # Eggs cost: $5 (from first meal) + $6 (from second) = $11
        assert eggs["est_cost"] == 11.0

    def test_empty_ingredients_no_division_by_zero(self):
        result = aggregate_grocery_list([_meal([], 10.0)])
        assert result["items"] == []
        assert result["total_est_cost"] == 0

    def test_sorted_output(self):
        result = aggregate_grocery_list([_meal(["Zucchini", "Apple", "Banana"])])
        names = [i["ingredient"] for i in result["items"]]
        assert names == sorted(names)
