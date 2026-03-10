"""Tests for Google Calendar API endpoints — all external calls mocked."""

from unittest.mock import patch, MagicMock

from tests.conftest import make_member


class TestAuthUrl:
    def test_member_not_found(self, client):
        resp = client.get("/api/v1/google-calendar/auth-url?member_id=999")
        assert resp.status_code == 404

    def test_success(self, client, session):
        m = make_member(session)
        with patch("api.google_calendar.get_auth_url", return_value="https://accounts.google.com/o/oauth2/auth?..."):
            resp = client.get(f"/api/v1/google-calendar/auth-url?member_id={m.id}")
            assert resp.status_code == 200
            assert "url" in resp.json()

    def test_missing_env(self, client, session):
        m = make_member(session)
        with patch("api.google_calendar.get_auth_url", side_effect=KeyError("GOOGLE_CLIENT_ID")):
            resp = client.get(f"/api/v1/google-calendar/auth-url?member_id={m.id}")
            assert resp.status_code == 500


class TestCallback:
    def test_success(self, client, session):
        m = make_member(session)
        fake_creds = {"token": "abc", "refresh_token": "def"}
        with patch("api.google_calendar.exchange_code", return_value=fake_creds):
            resp = client.post("/api/v1/google-calendar/callback", json={
                "code": "auth-code",
                "state": str(m.id),
            })
            assert resp.status_code == 200
            assert resp.json()["success"] is True

    def test_invalid_code(self, client, session):
        m = make_member(session)
        with patch("api.google_calendar.exchange_code", side_effect=Exception("Invalid code")):
            resp = client.post("/api/v1/google-calendar/callback", json={
                "code": "bad-code",
                "state": str(m.id),
            })
            assert resp.status_code == 400

    def test_member_not_found(self, client):
        with patch("api.google_calendar.exchange_code", return_value={}):
            resp = client.post("/api/v1/google-calendar/callback", json={
                "code": "code",
                "state": "999",
            })
            assert resp.status_code == 404


class TestSync:
    def test_member_not_found(self, client):
        resp = client.post("/api/v1/google-calendar/sync/999")
        assert resp.status_code == 404

    def test_no_credentials(self, client, session):
        m = make_member(session)
        resp = client.post(f"/api/v1/google-calendar/sync/{m.id}")
        assert resp.status_code == 400
        assert "no Google Calendar" in resp.json()["detail"]

    def test_success(self, client, session):
        m = make_member(session, google_credentials={"token": "abc"})
        with patch("api.google_calendar.sync_member_calendar", return_value={
            "imported": 5, "exported": 2, "updated": 1,
        }):
            resp = client.post(f"/api/v1/google-calendar/sync/{m.id}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["imported"] == 5

    def test_sync_failure(self, client, session):
        m = make_member(session, google_credentials={"token": "abc"})
        with patch("api.google_calendar.sync_member_calendar", side_effect=Exception("Token expired")):
            resp = client.post(f"/api/v1/google-calendar/sync/{m.id}")
            assert resp.status_code == 500


class TestDisconnect:
    def test_success(self, client, session):
        m = make_member(session, google_credentials={"token": "abc"})
        with patch("api.google_calendar.disconnect_member"):
            resp = client.delete(f"/api/v1/google-calendar/disconnect/{m.id}")
            assert resp.status_code == 200
            assert resp.json()["disconnected"] is True

    def test_not_found(self, client):
        resp = client.delete("/api/v1/google-calendar/disconnect/999")
        assert resp.status_code == 404
