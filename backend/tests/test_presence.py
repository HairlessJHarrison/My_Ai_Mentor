"""Tests for presence API endpoints."""

import datetime as dt

from tests.conftest import make_presence


class TestStartSession:
    def test_start(self, client):
        resp = client.post("/api/v1/presence/start", json={
            "planned_duration_min": 30,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "active"
        assert data["planned_duration_min"] == 30

    def test_conflict(self, client):
        client.post("/api/v1/presence/start", json={"planned_duration_min": 30})
        resp = client.post("/api/v1/presence/start", json={"planned_duration_min": 30})
        assert resp.status_code == 409


class TestEndSession:
    def test_end(self, client):
        client.post("/api/v1/presence/start", json={"planned_duration_min": 30})
        resp = client.post("/api/v1/presence/end")
        assert resp.status_code == 200
        data = resp.json()
        assert data["session"]["status"] == "completed"
        assert "activity" in data
        assert data["activity"]["points_earned"] >= 0

    def test_end_none_active(self, client):
        resp = client.post("/api/v1/presence/end")
        assert resp.status_code == 404


class TestGetCurrent:
    def test_active(self, client):
        client.post("/api/v1/presence/start", json={"planned_duration_min": 30})
        resp = client.get("/api/v1/presence/current")
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

    def test_none(self, client):
        resp = client.get("/api/v1/presence/current")
        assert resp.status_code == 200
        assert resp.json() is None


class TestGetStats:
    def test_empty(self, client):
        resp = client.get("/api/v1/presence/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_sessions"] == 0
        assert data["total_hours"] == 0

    def test_with_sessions(self, client, session):
        now = dt.datetime.now(dt.timezone.utc)
        make_presence(
            session,
            status="completed",
            start_time=now - dt.timedelta(minutes=30),
            end_time=now,
        )
        resp = client.get("/api/v1/presence/stats")
        data = resp.json()
        assert data["total_sessions"] == 1
        assert data["total_hours"] > 0
