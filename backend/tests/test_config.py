"""Tests for config endpoints."""


class TestConfig:
    def test_get_household_default(self, client):
        resp = client.get("/api/v1/config/household")
        assert resp.status_code == 200
        data = resp.json()
        assert data["household_name"] == "My Household"
        assert data["members"] == []

    def test_put_household_creates(self, client):
        resp = client.put(
            "/api/v1/config/household",
            json={"household_name": "The Smiths"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["household_name"] == "The Smiths"

    def test_put_household_updates(self, client):
        client.put("/api/v1/config/household", json={"household_name": "V1"})
        resp = client.put(
            "/api/v1/config/household",
            json={"household_name": "V2"},
        )
        data = resp.json()
        assert data["household_name"] == "V2"

    def test_get_schema(self, client):
        resp = client.get("/api/v1/config/schema")
        assert resp.status_code == 200
        data = resp.json()
        assert "models" in data
        assert "ScheduleEvent" in data["models"]
