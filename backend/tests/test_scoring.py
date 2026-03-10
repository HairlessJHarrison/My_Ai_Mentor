"""Tests for scoring API endpoints."""


class TestLogActivity:
    def test_log(self, client):
        resp = client.post("/api/v1/scoring/log-activity", json={
            "activity_type": "screen_free_family",
            "duration_min": 60,
            "participants_count": 1,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["points_earned"] == 10
        assert data["activity_type"] == "screen_free_family"

    def test_log_with_multiplier(self, client):
        resp = client.post("/api/v1/scoring/log-activity", json={
            "activity_type": "screen_free_family",
            "duration_min": 60,
            "participants_count": 3,
        })
        data = resp.json()
        assert data["points_earned"] == 15
        assert len(data["multipliers_applied"]) == 1


class TestGetToday:
    def test_empty(self, client):
        resp = client.get("/api/v1/scoring/today")
        assert resp.status_code == 200
        data = resp.json()
        assert data["activities"] == []
        assert data["total_points"] == 0

    def test_with_activity(self, client):
        client.post("/api/v1/scoring/log-activity", json={
            "activity_type": "outdoor",
            "duration_min": 60,
            "participants_count": 1,
        })
        resp = client.get("/api/v1/scoring/today")
        data = resp.json()
        assert len(data["activities"]) == 1
        assert data["total_points"] == 15


class TestTrends:
    def test_trends(self, client):
        resp = client.get("/api/v1/scoring/trends?weeks=2")
        assert resp.status_code == 200
        assert len(resp.json()["weeks"]) == 2


class TestStreaks:
    def test_streaks(self, client):
        resp = client.get("/api/v1/scoring/streaks")
        assert resp.status_code == 200
        assert "streaks" in resp.json()
