"""Tests for chores API endpoints."""

import datetime as dt

from tests.conftest import make_member, make_chore, make_chore_completion


class TestListChores:
    def test_empty(self, client):
        resp = client.get("/api/v1/chores")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_only_active(self, client, session):
        make_chore(session, title="Active", is_active=True)
        make_chore(session, title="Inactive", is_active=False)
        resp = client.get("/api/v1/chores")
        chores = resp.json()
        assert len(chores) == 1
        assert chores[0]["title"] == "Active"


class TestCreateChore:
    def test_create(self, client):
        resp = client.post("/api/v1/chores", json={
            "household_id": "default",
            "title": "Wash dishes",
            "points": 5,
        })
        assert resp.status_code == 201
        assert resp.json()["title"] == "Wash dishes"


class TestUpdateChore:
    def test_update(self, client, session):
        c = make_chore(session)
        resp = client.put(f"/api/v1/chores/{c.id}", json={"title": "Updated"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated"

    def test_not_found(self, client):
        resp = client.put("/api/v1/chores/999", json={"title": "X"})
        assert resp.status_code == 404


class TestDeleteChore:
    def test_soft_delete(self, client, session):
        c = make_chore(session)
        resp = client.delete(f"/api/v1/chores/{c.id}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True
        # Active list should be empty now
        assert client.get("/api/v1/chores").json() == []

    def test_not_found(self, client):
        resp = client.delete("/api/v1/chores/999")
        assert resp.status_code == 404


class TestCompleteChore:
    def test_complete(self, client, session):
        m = make_member(session)
        c = make_chore(session, points=10)
        resp = client.post("/api/v1/chores/complete", json={
            "chore_id": c.id,
            "member_id": m.id,
        })
        assert resp.status_code == 201
        assert resp.json()["points_earned"] == 10

    def test_not_found(self, client):
        resp = client.post("/api/v1/chores/complete", json={
            "chore_id": 999,
            "member_id": 1,
        })
        assert resp.status_code == 404

    def test_inactive_chore(self, client, session):
        m = make_member(session)
        c = make_chore(session, is_active=False)
        resp = client.post("/api/v1/chores/complete", json={
            "chore_id": c.id,
            "member_id": m.id,
        })
        assert resp.status_code == 400


class TestVerifyChore:
    def test_verify_by_parent(self, client, session):
        parent = make_member(session, name="Parent", role="parent")
        child = make_member(session, name="Child", role="child")
        c = make_chore(session, points=5)
        cc = make_chore_completion(session, chore_id=c.id, member_id=child.id)
        resp = client.post(
            f"/api/v1/chores/verify/{cc.id}",
            json={"verified_by": parent.id},
        )
        assert resp.status_code == 200
        assert resp.json()["verified_by"] == parent.id

    def test_verify_by_child_rejected(self, client, session):
        child = make_member(session, name="Child", role="child")
        c = make_chore(session)
        cc = make_chore_completion(session, chore_id=c.id, member_id=child.id)
        resp = client.post(
            f"/api/v1/chores/verify/{cc.id}",
            json={"verified_by": child.id},
        )
        assert resp.status_code == 403

    def test_not_found(self, client):
        resp = client.post("/api/v1/chores/verify/999", json={"verified_by": 1})
        assert resp.status_code == 404

    def test_missing_verified_by(self, client, session):
        c = make_chore(session)
        cc = make_chore_completion(session, chore_id=c.id, member_id=1)
        resp = client.post(f"/api/v1/chores/verify/{cc.id}", json={})
        assert resp.status_code == 400


class TestChoreStatus:
    def test_empty(self, client):
        resp = client.get("/api/v1/chores/status")
        assert resp.status_code == 200
        assert resp.json()["members"] == []

    def test_with_data(self, client, session):
        m = make_member(session)
        c = make_chore(session, assigned_member_ids=[])  # assigned to everyone
        make_chore_completion(session, chore_id=c.id, member_id=m.id)
        resp = client.get("/api/v1/chores/status")
        data = resp.json()
        assert len(data["members"]) == 1
        assert data["members"][0]["chores"][0]["completed"] is True

    def test_custom_date(self, client, session):
        m = make_member(session)
        c = make_chore(session)
        # Completion on a specific date
        make_chore_completion(
            session, chore_id=c.id, member_id=m.id,
            date=dt.date(2026, 3, 1),
        )
        resp = client.get("/api/v1/chores/status?date=2026-03-01")
        data = resp.json()
        assert data["members"][0]["chores"][0]["completed"] is True

        # Different date — not completed
        resp = client.get("/api/v1/chores/status?date=2026-03-02")
        data = resp.json()
        assert data["members"][0]["chores"][0]["completed"] is False
