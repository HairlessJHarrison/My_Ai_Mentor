"""Tests for schedules API endpoints."""

import datetime as dt
from unittest.mock import patch

from tests.conftest import make_event, make_member


class TestGetToday:
    def test_empty(self, client):
        resp = client.get("/api/v1/schedules/today")
        assert resp.status_code == 200
        data = resp.json()
        assert data["events"] == []
        assert len(data["free_blocks"]) >= 1

    def test_with_events(self, client, session):
        make_event(session, title="Morning meeting")
        resp = client.get("/api/v1/schedules/today")
        assert len(resp.json()["events"]) == 1


class TestGetWeek:
    def test_default_week(self, client):
        resp = client.get("/api/v1/schedules/week")
        assert resp.status_code == 200
        assert "events" in resp.json()

    def test_custom_start_date(self, client, session):
        make_event(session, date=dt.date(2026, 3, 10))
        resp = client.get("/api/v1/schedules/week?start_date=2026-03-09")
        assert resp.status_code == 200


class TestFreeBlocks:
    def test_default(self, client):
        resp = client.get("/api/v1/schedules/free-blocks")
        assert resp.status_code == 200

    def test_custom_days(self, client):
        resp = client.get("/api/v1/schedules/free-blocks?days=3")
        assert resp.status_code == 200


class TestCreateEvent:
    def test_create(self, client):
        resp = client.post("/api/v1/schedules/events", json={
            "household_id": "default",
            "date": "2026-03-10",
            "start_time": "09:00:00",
            "end_time": "10:00:00",
            "title": "Test Event",
            "event_type": "appointment",
        })
        assert resp.status_code == 201
        assert resp.json()["title"] == "Test Event"


class TestUpdateEvent:
    def test_update(self, client, session):
        e = make_event(session)
        resp = client.put(f"/api/v1/schedules/events/{e.id}", json={
            "title": "Updated Title",
        })
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"

    def test_not_found(self, client):
        resp = client.put("/api/v1/schedules/events/999", json={"title": "X"})
        assert resp.status_code == 404


class TestProtectEvent:
    def test_protect(self, client, session):
        e = make_event(session)
        resp = client.put(
            f"/api/v1/schedules/events/{e.id}/protect",
            json={"is_protected": True},
        )
        assert resp.status_code == 200
        assert resp.json()["is_protected"] is True

    def test_not_found(self, client):
        resp = client.put("/api/v1/schedules/events/999/protect", json={})
        assert resp.status_code == 404


class TestDeleteEvent:
    def test_delete(self, client, session):
        e = make_event(session)
        resp = client.delete(f"/api/v1/schedules/events/{e.id}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    def test_not_found(self, client):
        resp = client.delete("/api/v1/schedules/events/999")
        assert resp.status_code == 404


class TestMemberSchedule:
    def test_filter_by_member(self, client, session):
        m = make_member(session)
        make_event(session, assigned_member_ids=[m.id])
        make_event(session, title="Other event", assigned_member_ids=[999])
        resp = client.get(f"/api/v1/schedules/member/{m.id}")
        assert resp.status_code == 200
        events = resp.json()["events"]
        assert len(events) == 1


class TestTravelTime:
    def test_mocked(self, client):
        with patch("api.schedules.calculate_travel_time", return_value={
            "duration_min": 15, "distance_km": 10.0, "mode": "driving",
        }):
            # Note: the endpoint uses 'from' and 'to' as query param aliases
            resp = client.get("/api/v1/schedules/travel-time", params={
                "from": "Origin", "to": "Dest",
            })
            assert resp.status_code == 200
            assert resp.json()["duration_min"] == 15

    def test_no_api_key(self, client):
        with patch("api.schedules.calculate_travel_time", side_effect=RuntimeError("No key")):
            resp = client.get("/api/v1/schedules/travel-time", params={
                "from": "A", "to": "B",
            })
            assert resp.status_code == 503


class TestAutoTravelTime:
    def test_auto_travel(self, client, session):
        e = make_event(session, location="456 Park Ave")
        with patch("api.schedules.calculate_travel_time", return_value={
            "duration_min": 20, "distance_km": 15.0, "mode": "driving",
        }):
            resp = client.post(
                f"/api/v1/schedules/events/{e.id}/auto-travel",
                json={"from_location": "123 Main St"},
            )
            assert resp.status_code == 200
            assert resp.json()["travel_time_min"] == 20

    def test_no_location(self, client, session):
        e = make_event(session, location=None)
        resp = client.post(
            f"/api/v1/schedules/events/{e.id}/auto-travel",
            json={"from_location": "123 Main St"},
        )
        assert resp.status_code == 400
        assert "no location" in resp.json()["detail"].lower()

    def test_not_found(self, client):
        resp = client.post(
            "/api/v1/schedules/events/999/auto-travel",
            json={"from_location": "X"},
        )
        assert resp.status_code == 404
