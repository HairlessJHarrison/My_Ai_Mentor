"""Tests for meals API endpoints."""

import datetime as dt

from tests.conftest import make_meal


class TestGetPlan:
    def test_empty(self, client):
        resp = client.get("/api/v1/meals/plan")
        assert resp.status_code == 200
        data = resp.json()
        assert data["meals"] == []
        assert data["total_cost"] == 0
        assert data["avg_health_score"] == 0

    def test_with_meals(self, client, session):
        make_meal(session, est_cost=10.0, health_score=8)
        make_meal(session, est_cost=20.0, health_score=6, recipe_name="Meal 2")
        resp = client.get("/api/v1/meals/plan")
        data = resp.json()
        assert len(data["meals"]) == 2
        assert data["total_cost"] == 30.0
        assert data["avg_health_score"] == 7.0

    def test_specific_date(self, client, session):
        make_meal(session, date=dt.date(2026, 3, 10))
        make_meal(session, date=dt.date(2026, 3, 15), recipe_name="Other")
        resp = client.get("/api/v1/meals/plan?date=2026-03-10")
        assert len(resp.json()["meals"]) == 1


class TestCreatePlan:
    def test_create(self, client):
        resp = client.post("/api/v1/meals/plan", json={
            "household_id": "default",
            "date": "2026-03-10",
            "meal_type": "dinner",
            "recipe_name": "Pasta",
            "ingredients": ["pasta", "sauce"],
            "est_cost": 12.0,
            "health_score": 7,
            "prep_time_min": 25,
        })
        assert resp.status_code == 201
        assert resp.json()["recipe_name"] == "Pasta"

    def test_health_score_validation(self, client):
        resp = client.post("/api/v1/meals/plan", json={
            "household_id": "default",
            "date": "2026-03-10",
            "meal_type": "dinner",
            "recipe_name": "Bad",
            "ingredients": [],
            "est_cost": 5.0,
            "health_score": 0,  # invalid: ge=1
            "prep_time_min": 10,
        })
        assert resp.status_code == 422


class TestUpdatePlan:
    def test_update(self, client, session):
        m = make_meal(session)
        resp = client.put(f"/api/v1/meals/plan/{m.id}", json={
            "recipe_name": "Updated Recipe",
        })
        assert resp.status_code == 200
        assert resp.json()["recipe_name"] == "Updated Recipe"

    def test_not_found(self, client):
        resp = client.put("/api/v1/meals/plan/999", json={"recipe_name": "X"})
        assert resp.status_code == 404


class TestDeletePlan:
    def test_delete(self, client, session):
        m = make_meal(session)
        resp = client.delete(f"/api/v1/meals/plan/{m.id}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    def test_not_found(self, client):
        resp = client.delete("/api/v1/meals/plan/999")
        assert resp.status_code == 404


class TestGroceryList:
    def test_empty(self, client):
        resp = client.get("/api/v1/meals/grocery-list")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total_est_cost"] == 0

    def test_aggregation(self, client, session):
        make_meal(session, ingredients=["Eggs", "Cheese"], est_cost=10.0)
        make_meal(session, ingredients=["eggs", "Milk"], est_cost=8.0, recipe_name="M2")
        resp = client.get("/api/v1/meals/grocery-list")
        data = resp.json()
        # "Eggs" and "eggs" should merge
        eggs = [i for i in data["items"] if i["ingredient"].lower() == "eggs"]
        assert len(eggs) == 1
        assert eggs[0]["quantity_needed"] == 2
