"""Tests for authentication middleware."""

from unittest.mock import patch


class TestAuth:
    def test_no_auth_dev_mode(self, client):
        """Auth bypassed when no API key is configured."""
        resp = client.get("/api/v1/members")
        assert resp.status_code == 200

    def test_auth_required_when_key_set(self, client):
        with patch("auth.API_KEY", "test-secret-key"):
            resp = client.get("/api/v1/members")
            assert resp.status_code == 401

    def test_auth_valid_key(self, client):
        with patch("auth.API_KEY", "test-secret-key"):
            resp = client.get(
                "/api/v1/members",
                headers={"Authorization": "Bearer test-secret-key"},
            )
            assert resp.status_code == 200

    def test_auth_invalid_key(self, client):
        with patch("auth.API_KEY", "test-secret-key"):
            resp = client.get(
                "/api/v1/members",
                headers={"Authorization": "Bearer wrong-key"},
            )
            assert resp.status_code == 403
