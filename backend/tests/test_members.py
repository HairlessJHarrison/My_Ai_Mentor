"""Tests for members API endpoints."""

import datetime as dt

from tests.conftest import make_member, make_activity, make_goal_completion, make_chore_completion, make_goal, make_chore


class TestListMembers:
    def test_empty(self, client):
        resp = client.get("/api/v1/members")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_created(self, client, session):
        make_member(session, name="Alice")
        make_member(session, name="Bob")
        resp = client.get("/api/v1/members")
        names = [m["name"] for m in resp.json()]
        assert "Alice" in names
        assert "Bob" in names


class TestCreateMember:
    def test_create(self, client):
        resp = client.post("/api/v1/members", json={
            "household_id": "default",
            "name": "Alice",
            "role": "parent",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Alice"
        assert data["id"] is not None

    def test_missing_name(self, client):
        resp = client.post("/api/v1/members", json={
            "household_id": "default",
            "role": "parent",
        })
        assert resp.status_code == 422

    def test_invalid_role(self, client):
        resp = client.post("/api/v1/members", json={
            "household_id": "default",
            "name": "Test",
            "role": "admin",
        })
        assert resp.status_code == 422


class TestUpdateMember:
    def test_update(self, client, session):
        m = make_member(session, name="Alice")
        resp = client.put(f"/api/v1/members/{m.id}", json={"name": "Alicia"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Alicia"

    def test_not_found(self, client):
        resp = client.put("/api/v1/members/999", json={"name": "X"})
        assert resp.status_code == 404


class TestDeleteMember:
    def test_delete(self, client, session):
        m = make_member(session)
        resp = client.delete(f"/api/v1/members/{m.id}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True
        # Verify gone
        assert client.get("/api/v1/members").json() == []

    def test_not_found(self, client):
        resp = client.delete("/api/v1/members/999")
        assert resp.status_code == 404


class TestMemberScore:
    def test_score_no_activities(self, client, session):
        m = make_member(session)
        resp = client.get(f"/api/v1/members/{m.id}/score")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_points"] == 0
        assert data["breakdown"]["activities"] == 0

    def test_score_with_data(self, client, session):
        m = make_member(session)
        make_activity(session, points_earned=20)
        goal = make_goal(session, member_id=m.id)
        make_goal_completion(session, goal_id=goal.id, member_id=m.id, points_earned=15)
        chore = make_chore(session)
        make_chore_completion(session, chore_id=chore.id, member_id=m.id, points_earned=5)

        resp = client.get(f"/api/v1/members/{m.id}/score?period=all")
        data = resp.json()
        assert data["breakdown"]["activities"] == 20
        assert data["breakdown"]["goals"] == 15
        assert data["breakdown"]["chores"] == 5
        assert data["total_points"] == 40

    def test_score_not_found(self, client):
        resp = client.get("/api/v1/members/999/score")
        assert resp.status_code == 404
