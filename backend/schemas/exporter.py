"""JSON Schema exporter — export all Pydantic model schemas for OpenClaw skill generation."""

from models.schedule import ScheduleEvent, ScheduleEventCreate, ScheduleEventUpdate
from models.meal import MealPlan, MealPlanCreate, MealPlanUpdate
from models.transaction import Transaction, TransactionCreate
from models.budget import Budget, BudgetCreate
from models.activity import Activity, ActivityCreate
from models.presence import PresenceSession, PresenceSessionCreate
from models.config import HouseholdConfig, HouseholdConfigUpdate


def export_all_schemas() -> dict:
    """Export JSON Schemas for all Pydantic/SQLModel models.

    Returns a dict keyed by model name with JSON Schema values.
    """
    models = [
        ScheduleEvent, ScheduleEventCreate, ScheduleEventUpdate,
        MealPlan, MealPlanCreate, MealPlanUpdate,
        Transaction, TransactionCreate,
        Budget, BudgetCreate,
        Activity, ActivityCreate,
        PresenceSession, PresenceSessionCreate,
        HouseholdConfig, HouseholdConfigUpdate,
    ]

    schemas = {}
    for model in models:
        schemas[model.__name__] = model.model_json_schema()

    return schemas
