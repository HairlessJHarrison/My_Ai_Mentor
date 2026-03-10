"""Tests for travel_time — mock external API calls."""

import json
from unittest.mock import patch, MagicMock

from services.travel_time import calculate_travel_time


class TestCalculateTravelTime:
    def test_no_api_key_raises(self):
        with patch("services.travel_time.GOOGLE_MAPS_API_KEY", ""):
            with pytest.raises(RuntimeError, match="GOOGLE_MAPS_API_KEY"):
                calculate_travel_time("A", "B")

    def test_successful_response(self):
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "status": "OK",
            "routes": [{
                "legs": [{
                    "duration": {"value": 900},   # 15 min
                    "distance": {"value": 10000},  # 10 km
                }]
            }],
        }).encode()
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)

        with patch("services.travel_time.GOOGLE_MAPS_API_KEY", "test-key"):
            with patch("urllib.request.urlopen", return_value=mock_response):
                result = calculate_travel_time("Origin", "Dest")

        assert result["duration_min"] == 15
        assert result["distance_km"] == 10.0
        assert result["mode"] == "driving"

    def test_api_error_status(self):
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "status": "ZERO_RESULTS",
            "routes": [],
        }).encode()
        mock_response.__enter__ = lambda s: s
        mock_response.__exit__ = MagicMock(return_value=False)

        with patch("services.travel_time.GOOGLE_MAPS_API_KEY", "test-key"):
            with patch("urllib.request.urlopen", return_value=mock_response):
                with pytest.raises(ValueError, match="Google Maps API error"):
                    calculate_travel_time("Origin", "Dest")


import pytest
