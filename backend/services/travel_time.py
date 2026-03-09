"""Travel time service — Google Maps Directions API integration."""

import os
import urllib.parse
import urllib.request
import json


GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
DIRECTIONS_BASE_URL = "https://maps.googleapis.com/maps/api/directions/json"


def calculate_travel_time(
    origin: str,
    destination: str,
    mode: str = "driving",
) -> dict:
    """Calculate travel time between two locations using Google Maps Directions API.

    Returns: {duration_min, distance_km, mode}
    """
    if not GOOGLE_MAPS_API_KEY:
        raise RuntimeError(
            "GOOGLE_MAPS_API_KEY environment variable is not set. "
            "Set it in your .env file to enable travel time calculations."
        )

    params = urllib.parse.urlencode({
        "origin": origin,
        "destination": destination,
        "mode": mode,
        "key": GOOGLE_MAPS_API_KEY,
    })

    url = f"{DIRECTIONS_BASE_URL}?{params}"
    req = urllib.request.Request(url)

    with urllib.request.urlopen(req, timeout=10) as response:
        data = json.loads(response.read().decode())

    if data.get("status") != "OK" or not data.get("routes"):
        error_msg = data.get("error_message", data.get("status", "Unknown error"))
        raise ValueError(f"Google Maps API error: {error_msg}")

    leg = data["routes"][0]["legs"][0]
    duration_seconds = leg["duration"]["value"]
    distance_meters = leg["distance"]["value"]

    return {
        "duration_min": round(duration_seconds / 60),
        "distance_km": round(distance_meters / 1000, 1),
        "mode": mode,
    }
