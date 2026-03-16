"""Tests for the AI context consolidated endpoint."""

import datetime as dt

from tests.conftest import (
    make_member, make_event, make_meal, make_budget,
    make_transaction, make_activity, make_chore, make_chore_completion,
    make_presence,
)


class TestAiContext:
    def test_empty_context(self, client):
        """Returns valid structure even with no data."""
        resp = client.get("/api/v1/ai/context")
        assert resp.status_code == 200
        data = resp.json()
        assert "household" in data
        assert "members" in data
        assert "today_schedule" in data
        assert "today_meals" in data
        assert "budget_summary" in data
        assert "today_score" in data
        assert "active_presence_session" in data
        assert "pending_chores" in data

    def test_context_with_members(self, client, session):
        make_member(session, name="Alice")
        make_member(session, name="Bob")
        resp = client.get("/api/v1/ai/context")
        data = resp.json()
        assert len(data["members"]) == 2

    def test_context_with_schedule(self, client, session):
        make_event(session, title="Morning Run", date=dt.date.today())
        resp = client.get("/api/v1/ai/context")
        data = resp.json()
        assert len(data["today_schedule"]["events"]) == 1
        assert data["today_schedule"]["events"][0]["title"] == "Morning Run"
        assert "free_blocks" in data["today_schedule"]

    def test_context_with_meals(self, client, session):
        make_meal(session, recipe_name="Pasta", date=dt.date.today())
        resp = client.get("/api/v1/ai/context")
        data = resp.json()
        assert len(data["today_meals"]) == 1
        assert data["today_meals"][0]["recipe_name"] == "Pasta"

    def test_context_with_budget(self, client, session):
        today = dt.date.today()
        make_budget(session, category="groceries", limit_amount=500.0)
        make_transaction(session, amount=-100.0, category="groceries", date=today)
        resp = client.get("/api/v1/ai/context")
        data = resp.json()
        cats = data["budget_summary"]["categories"]
        assert len(cats) == 1
        assert cats[0]["category"] == "groceries"
        assert cats[0]["spent"] == 100.0
        assert cats[0]["remaining"] == 400.0

    def test_context_with_score(self, client, session):
        make_activity(session, points_earned=25, date=dt.date.today())
        resp = client.get("/api/v1/ai/context")
        data = resp.json()
        assert data["today_score"]["total_points"] == 25
        assert len(data["today_score"]["activities"]) == 1

    def test_context_with_active_presence(self, client, session):
        make_presence(session, status="active")
        resp = client.get("/api/v1/ai/context")
        data = resp.json()
        assert data["active_presence_session"] is not None
        assert data["active_presence_session"]["status"] == "active"

    def test_context_no_active_presence(self, client, session):
        make_presence(session, status="completed")
        resp = client.get("/api/v1/ai/context")
        data = resp.json()
        assert data["active_presence_session"] is None

    def test_context_with_chores(self, client, session):
        m = make_member(session, name="Alice")
        chore = make_chore(session, title="Dishes", assigned_member_ids=[m.id])
        resp = client.get("/api/v1/ai/context")
        data = resp.json()
        chore_members = data["pending_chores"]["members"]
        assert len(chore_members) >= 1
        alice_chores = [cm for cm in chore_members if cm["member_id"] == m.id]
        assert len(alice_chores) == 1
        assert alice_chores[0]["chores"][0]["completed"] is False

    def test_context_chores_completed(self, client, session):
        m = make_member(session, name="Alice")
        chore = make_chore(session, title="Dishes", assigned_member_ids=[m.id])
        make_chore_completion(session, chore_id=chore.id, member_id=m.id, date=dt.date.today())
        resp = client.get("/api/v1/ai/context")
        data = resp.json()
        chore_members = data["pending_chores"]["members"]
        alice_chores = [cm for cm in chore_members if cm["member_id"] == m.id]
        assert alice_chores[0]["chores"][0]["completed"] is True

    def test_context_excludes_past_events(self, client, session):
        """Events from yesterday should NOT appear in today's context."""
        yesterday = dt.date.today() - dt.timedelta(days=1)
        make_event(session, title="Old Event", date=yesterday)
        resp = client.get("/api/v1/ai/context")
        data = resp.json()
        assert len(data["today_schedule"]["events"]) == 0
