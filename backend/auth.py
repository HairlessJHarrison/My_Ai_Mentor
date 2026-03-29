"""Authentication and rate limiting middleware."""

import os
import time
from collections import defaultdict

from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

security = HTTPBearer(auto_error=False)

API_KEY = os.getenv("UNPLUGGED_API_KEY")

# --- Rate Limiting ---
# Simple in-memory rate limiter. For production at scale, use Redis-backed solutions.
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "600"))  # requests per window
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))  # window in seconds

_request_counts: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(client_ip: str) -> None:
    """Enforce rate limiting per client IP."""
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW

    # Remove expired timestamps
    _request_counts[client_ip] = [
        ts for ts in _request_counts[client_ip] if ts > window_start
    ]

    if len(_request_counts[client_ip]) >= RATE_LIMIT_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Maximum {RATE_LIMIT_REQUESTS} requests per {RATE_LIMIT_WINDOW} seconds.",
            headers={"Retry-After": str(RATE_LIMIT_WINDOW)},
        )

    _request_counts[client_ip].append(now)


# --- Authentication ---

async def verify_api_key(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> str | None:
    """Verify API key and enforce rate limiting.

    - If no API_KEY is configured (dev mode): auth is skipped, rate limiting still applies.
    - If API_KEY is configured: Bearer token must match exactly.
    """
    # Rate limit check (always applies)
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    # Auth check
    if not API_KEY:
        return None  # No key configured = dev mode, skip auth

    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing API key. Provide 'Authorization: Bearer <UNPLUGGED_API_KEY>' header.",
        )

    if credentials.credentials != API_KEY:
        raise HTTPException(
            status_code=403,
            detail="Invalid API key.",
        )

    return credentials.credentials
