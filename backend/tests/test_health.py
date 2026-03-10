"""Tests for health endpoint."""


def test_health_returns_ok(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"
    assert "uptime_seconds" in data
