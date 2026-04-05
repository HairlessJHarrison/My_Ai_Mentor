"""Config module — household configuration CRUD and schema export."""

import datetime as dt
import os

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.config import HouseholdConfig, HouseholdConfigUpdate
from schemas.exporter import export_all_schemas
from websocket import manager

router = APIRouter(prefix="/api/v1/config", tags=["Configuration"])

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


@router.get("/household")
async def get_household(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Get household configuration."""
    config = session.exec(
        select(HouseholdConfig).where(HouseholdConfig.household_id == HOUSEHOLD_ID)
    ).first()

    if not config:
        # Return a default config if none exists
        return {
            "household_id": HOUSEHOLD_ID,
            "household_name": "My Household",
            "members": [],
            "health_goals": [],
            "dietary_restrictions": [],
            "preferences": {},
            "weekly_reflection_narrative": None,
        }

    return config.model_dump(mode="json")


@router.put("/household")
async def update_household(
    body: HouseholdConfigUpdate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Update household configuration. Creates if doesn't exist."""
    config = session.exec(
        select(HouseholdConfig).where(HouseholdConfig.household_id == HOUSEHOLD_ID)
    ).first()

    if not config:
        # Create a new config
        config = HouseholdConfig(
            household_id=HOUSEHOLD_ID,
            household_name=body.household_name or "My Household",
        )

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)
    config.updated_at = dt.datetime.now(dt.timezone.utc)

    session.add(config)
    session.commit()
    session.refresh(config)

    await manager.broadcast("config_updated", config.model_dump(mode="json"))
    return config


@router.get("/schema")
async def get_schema(
    _auth: str = Depends(verify_api_key),
):
    """Export all Pydantic model JSON Schemas for OpenClaw skill generation."""
    return {"models": export_all_schemas()}
