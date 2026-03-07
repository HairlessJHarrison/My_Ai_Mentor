import os
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

security = HTTPBearer(auto_error=False)

API_KEY = os.getenv("UNPLUGGED_API_KEY")


async def verify_api_key(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> str | None:
    if not API_KEY:
        return None  # No key configured = dev mode, skip auth
    if not credentials or credentials.credentials != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return credentials.credentials
