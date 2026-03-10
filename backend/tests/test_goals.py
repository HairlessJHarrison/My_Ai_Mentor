"""Tests for goals API endpoints."""

import datetime as dt

from tests.conftest import make_member, make_goal, make_goal_completion


class TestListGoals:
    def test_empty(self, client):
        resp = client.get("/api/v1/goals")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_filter_by_member(self, client, session):
        m1 = make_member(session, name="Alice")
        m2 = make_member(session, name="Bob")
        make_goal(session, member_id=m1.id, title="G1")
        make_goal(session, member_id=m2.id, title="G2")
        resp = client.get(f"/api/v1/goals?member_id={m1.id}")
        goals = resp.json()
        assert len(goals) == 1
        assert goals[0]["title"] == "G1"


class TestCreateGoal:
    def test_create(self, client, session):
        m = make_member(session)
        resp = client.post("/api/v1/goals", json={
            "household_id": "default",
            "member_id": m.id,
            "title": "Read daily",
            "category": "learning",
        })
        assert resp.status_code == 201
        assert resp.json()["is_active"] is True

    def test_invalid_category(self, client, session):
        m = make_member(session)
        resp = client.post("/api/v1/goals", json={
            "household_id": "default",
            "member_id": m.id,
            "title": "Bad",
            "category": "invalid_cat",
        })
        assert resp.status_code == 422


class TestUpdateGoal:
    def test_update(self, client, session):
        m = make_member(session)
        g = make_goal(session, member_id=m.id)
        resp = client.put(f"/api/v1/goals/{g.id}", json={"title": "Updated"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated"

    def test_not_found(self, client):
        resp = client.put("/api/v1/goals/999", json={"title": "X"})
        assert resp.status_code == 404


class TestDeleteGoal:
    def test_soft_delete(self, client, session):
        m = make_member(session)
        g = make_goal(session, member_id=m.id)
        resp = client.delete(f"/api/v1/goals/{g.id}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True
        # Goal still exists but is inactive — list returns only active
        # But the list endpoint filters by household, not is_active,
        # so let's check via direct query
        resp = client.get("/api/v1/goals")
        # Should still show in list (list returns all, not just active)
        # Actually looking at the code, list_goals doesn't filter is_active
        goals = resp.json()
        deactivated = [g for g in goals if g["is_active"] is False]
        assert len(deactivated) == 1

    def test_not_found(self, client):
        resp = client.delete("/api/v1/goals/999")
        assert resp.status_code == 404


class TestCompleteGoal:
    def test_complete(self, client, session):
        m = make_member(session)
        g = make_goal(session, member_id=m.id, points_per_completion=10)
        resp = client.post("/api/v1/goals/complete", json={
            "goal_id": g.id,
            "member_id": m.id,
        })
        assert resp.status_code == 201
        assert resp.json()["points_earned"] == 10

    def test_not_found(self, client):
        resp = client.post("/api/v1/goals/complete", json={
            "goal_id": 999,
            "member_id": 1,
        })
        assert resp.status_code == 404

    def test_inactive_goal(self, client, session):
        m = make_member(session)
        g = make_goal(session, member_id=m.id, is_active=False)
        resp = client.post("/api/v1/goals/complete", json={
            "goal_id": g.id,
            "member_id": m.id,
        })
        assert resp.status_code == 400

    def test_streak_multiplier(self, client, session):
        m = make_member(session)
        g = make_goal(session, member_id=m.id, points_per_completion=10)
        today = dt.date.today()
        # Seed 2 days of completions
        for i in range(1, 3):
            make_goal_completion(
                session,
                goal_id=g.id,
                member_id=m.id,
                date=today - dt.timedelta(days=i),
                points_earned=10,
            )
        resp = client.post("/api/v1/goals/complete", json={
            "goal_id": g.id,
            "member_id": m.id,
        })
        assert resp.json()["points_earned"] == 15  # 10 * 1.5


class TestGetProgress:
    def test_progress(self, client, session):
        m = make_member(session)
        g = make_goal(session, member_id=m.id)
        make_goal_completion(session, goal_id=g.id, member_id=m.id, points_earned=10)
        resp = client.get(f"/api/v1/goals/progress?member_id={m.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["goals"]) == 1
        assert data["goals"][0]["points_total"] == 10
