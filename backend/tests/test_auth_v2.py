"""Tests for auth hardening and rate limiting."""

from unittest.mock import patch

import auth


class TestAuthErrorMessages:
    def test_missing_key_returns_401(self, client):
        """Missing Bearer token when API_KEY is required returns 401 with message."""
        with patch("auth.API_KEY", "test-secret-key"):
            resp = client.get("/api/v1/members")
            assert resp.status_code == 401
            assert "Missing API key" in resp.json()["detail"]

    def test_invalid_key_returns_403(self, client):
        """Wrong Bearer token returns 403 (not 401) with distinct message."""
        with patch("auth.API_KEY", "test-secret-key"):
            resp = client.get(
                "/api/v1/members",
                headers={"Authorization": "Bearer wrong-key"},
            )
            assert resp.status_code == 403
            assert "Invalid API key" in resp.json()["detail"]

    def test_valid_key_passes(self, client):
        """Correct Bearer token returns 200."""
        with patch("auth.API_KEY", "test-secret-key"):
            resp = client.get(
                "/api/v1/members",
                headers={"Authorization": "Bearer test-secret-key"},
            )
            assert resp.status_code == 200

    def test_dev_mode_no_key(self, client):
        """No API_KEY configured = dev mode, auth bypassed."""
        with patch("auth.API_KEY", None):
            resp = client.get("/api/v1/members")
            assert resp.status_code == 200


class TestRateLimiting:
    def setup_method(self):
        """Clear rate limit state before each test."""
        auth._request_counts.clear()

    def test_under_limit(self, client):
        """Requests under the limit should succeed."""
        with patch("auth.RATE_LIMIT_REQUESTS", 5), patch("auth.RATE_LIMIT_WINDOW", 60):
            for _ in range(5):
                resp = client.get("/api/v1/health")
                assert resp.status_code == 200

    def test_rate_limit_exceeded(self, client):
        """Exceeding rate limit returns 429 with Retry-After header."""
        with patch("auth.RATE_LIMIT_REQUESTS", 3), patch("auth.RATE_LIMIT_WINDOW", 60):
            auth._request_counts.clear()
            # First 3 should succeed (health doesn't use verify_api_key, but
            # let's test on an endpoint that does)
            for _ in range(3):
                resp = client.get("/api/v1/members")
                assert resp.status_code == 200

            # 4th should be rate-limited
            resp = client.get("/api/v1/members")
            assert resp.status_code == 429
            assert "Rate limit exceeded" in resp.json()["detail"]

    def test_rate_limit_doesnt_affect_other_ips(self, client):
        """Rate limiting is per-IP, different IPs have separate limits."""
        # The test client always uses 'testclient' as the host,
        # so this just verifies the counter isolation logic directly
        with patch("auth.RATE_LIMIT_REQUESTS", 2), patch("auth.RATE_LIMIT_WINDOW", 60):
            auth._request_counts.clear()
            # Directly test the internal function
            auth._check_rate_limit("192.168.1.1")
            auth._check_rate_limit("192.168.1.1")
            # Different IP should still be fine
            auth._check_rate_limit("192.168.1.2")  # should not raise

            # Same IP should be rate limited
            try:
                auth._check_rate_limit("192.168.1.1")
                assert False, "Should have raised HTTPException"
            except Exception as e:
                assert "429" in str(e.status_code)
