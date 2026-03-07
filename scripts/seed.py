"""Seed the Unplugged database with sample data for testing.

Usage: cd backend && python ../scripts/seed.py
"""
import sys
import os
# When run from the backend/ directory, just add the current dir to path
sys.path.insert(0, os.getcwd())

import datetime as dt
from sqlmodel import Session
from database import engine, create_db_and_tables
from models.schedule import ScheduleEvent
from models.meal import MealPlan
from models.transaction import Transaction
from models.budget import Budget
from models.activity import Activity

HOUSEHOLD = "default"


def seed():
    create_db_and_tables()

    with Session(engine) as session:
        today = dt.date.today()
        monday = today - dt.timedelta(days=today.weekday())

        # --- Schedule Events ---
        events = [
            ScheduleEvent(household_id=HOUSEHOLD, date=monday, start_time=dt.time(9, 0), end_time=dt.time(10, 30),
                         title="Team Standup", event_type="work", source="manual"),
            ScheduleEvent(household_id=HOUSEHOLD, date=monday, start_time=dt.time(15, 0), end_time=dt.time(16, 0),
                         title="Kids Soccer Practice", event_type="appointment", source="manual", participants=["Parent", "Child1"]),
            ScheduleEvent(household_id=HOUSEHOLD, date=monday + dt.timedelta(days=2), start_time=dt.time(18, 0), end_time=dt.time(19, 30),
                         title="Family Game Night", event_type="protected_time", source="manual", is_protected=True, participants=["Parent", "Child1", "Child2"]),
            ScheduleEvent(household_id=HOUSEHOLD, date=monday + dt.timedelta(days=4), start_time=dt.time(10, 0), end_time=dt.time(11, 0),
                         title="Dentist Appointment", event_type="appointment", source="manual"),
        ]
        for e in events:
            session.add(e)

        # --- Meal Plans ---
        meals = [
            MealPlan(household_id=HOUSEHOLD, date=monday, meal_type="dinner",
                    recipe_name="Lemon Herb Chicken", ingredients=["chicken breast", "lemon", "herbs", "garlic", "olive oil"],
                    est_cost=12.50, health_score=8, prep_time_min=35),
            MealPlan(household_id=HOUSEHOLD, date=monday + dt.timedelta(days=1), meal_type="dinner",
                    recipe_name="Veggie Stir Fry", ingredients=["tofu", "broccoli", "bell pepper", "soy sauce", "rice"],
                    est_cost=8.00, health_score=9, prep_time_min=25),
            MealPlan(household_id=HOUSEHOLD, date=monday + dt.timedelta(days=2), meal_type="dinner",
                    recipe_name="Spaghetti Bolognese", ingredients=["ground beef", "pasta", "tomato sauce", "onion", "garlic"],
                    est_cost=10.00, health_score=6, prep_time_min=40),
            MealPlan(household_id=HOUSEHOLD, date=monday + dt.timedelta(days=3), meal_type="breakfast",
                    recipe_name="Overnight Oats", ingredients=["oats", "yogurt", "berries", "honey"],
                    est_cost=4.00, health_score=9, prep_time_min=5),
        ]
        for m in meals:
            session.add(m)

        # --- Budgets ---
        month = today.strftime("%Y-%m")
        budgets = [
            Budget(household_id=HOUSEHOLD, month=month, category="groceries", limit_amount=500.00),
            Budget(household_id=HOUSEHOLD, month=month, category="dining", limit_amount=200.00),
            Budget(household_id=HOUSEHOLD, month=month, category="entertainment", limit_amount=150.00),
            Budget(household_id=HOUSEHOLD, month=month, category="transport", limit_amount=100.00),
        ]
        for b in budgets:
            session.add(b)

        # --- Transactions ---
        txns = [
            Transaction(household_id=HOUSEHOLD, date=today - dt.timedelta(days=3), amount=-85.50,
                       description="Weekly groceries", category="groceries", source="manual"),
            Transaction(household_id=HOUSEHOLD, date=today - dt.timedelta(days=2), amount=-32.00,
                       description="Pizza night out", category="dining", source="manual"),
            Transaction(household_id=HOUSEHOLD, date=today - dt.timedelta(days=1), amount=-15.00,
                       description="Movie tickets", category="entertainment", source="manual"),
            Transaction(household_id=HOUSEHOLD, date=today, amount=-45.00,
                       description="Gas station", category="transport", source="manual"),
        ]
        for t in txns:
            session.add(t)

        # --- Activities ---
        activities = [
            Activity(household_id=HOUSEHOLD, date=today - dt.timedelta(days=1),
                    activity_type="outdoor", duration_min=60, participants_count=3,
                    points_earned=45, multipliers_applied=["family activity (2+ participants)"]),
            Activity(household_id=HOUSEHOLD, date=today - dt.timedelta(days=1),
                    activity_type="shared_meal", duration_min=30, participants_count=4,
                    points_earned=10, multipliers_applied=["home-cooked (linked to meal plan)"]),
            Activity(household_id=HOUSEHOLD, date=today,
                    activity_type="screen_free_family", duration_min=45, participants_count=2,
                    points_earned=11, multipliers_applied=["2+ participants"]),
        ]
        for a in activities:
            session.add(a)

        session.commit()
        print("🌿 Seeded database with sample data!")
        print(f"   {len(events)} schedule events")
        print(f"   {len(meals)} meal plans")
        print(f"   {len(budgets)} budget categories")
        print(f"   {len(txns)} transactions")
        print(f"   {len(activities)} scored activities")


if __name__ == "__main__":
    seed()
