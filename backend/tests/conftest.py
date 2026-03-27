"""Shared test fixtures — in-memory SQLite DB, test client, factory helpers."""

import os

# Set env vars BEFORE any backend imports
os.environ["DATABASE_URL"] = "sqlite://"
os.environ.pop("UNPLUGGED_API_KEY", None)
os.environ["HOUSEHOLD_ID"] = "default"
os.environ.pop("GOOGLE_MAPS_API_KEY", None)

import datetime as dt

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import database
from database import get_session

# Single shared in-memory SQLite — StaticPool ensures all connections
# use the same underlying connection (same in-memory database).
TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Replace the module-level engine so that create_db_and_tables() and any
# code importing `database.engine` directly all use our test engine.
database.engine = TEST_ENGINE

from main import app  # noqa: E402  — import after patching engine


@pytest.fixture(autouse=True)
def _setup_db():
    """Create all tables before each test, drop after."""
    # Import models to ensure they are registered with SQLModel metadata
    import models  # noqa: F401
    SQLModel.metadata.create_all(TEST_ENGINE)
    yield
    SQLModel.metadata.drop_all(TEST_ENGINE)


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    """Clear rate limiter state between tests."""
    import auth
    auth._request_counts.clear()
    yield
    auth._request_counts.clear()


@pytest.fixture()
def session():
    """Yield a DB session bound to the in-memory test engine."""
    with Session(TEST_ENGINE) as s:
        yield s


@pytest.fixture()
def client(session):
    """HTTPX TestClient with the test session wired in."""
    from starlette.testclient import TestClient

    def _override_session():
        yield session

    app.dependency_overrides[get_session] = _override_session
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# --------------- Factory helpers ---------------
# These are importable via `from tests.conftest import make_*`
# For files in tests/services/, use `from tests.conftest import make_*`

def make_member(session: Session, **overrides) -> "Member":
    from models.member import Member
    defaults = dict(
        household_id="default",
        name="Test User",
        role="parent",
        color="#22c55e",
    )
    defaults.update(overrides)
    m = Member(**defaults)
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


def make_event(session: Session, **overrides) -> "ScheduleEvent":
    from models.schedule import ScheduleEvent
    defaults = dict(
        household_id="default",
        date=dt.date.today(),
        start_time=dt.time(9, 0),
        end_time=dt.time(10, 0),
        title="Test Event",
        event_type="appointment",
    )
    defaults.update(overrides)
    e = ScheduleEvent(**defaults)
    session.add(e)
    session.commit()
    session.refresh(e)
    return e


def make_meal(session: Session, **overrides) -> "MealPlan":
    from models.meal import MealPlan
    defaults = dict(
        household_id="default",
        date=dt.date.today(),
        meal_type="dinner",
        recipe_name="Test Recipe",
        ingredients=["eggs", "cheese"],
        est_cost=10.0,
        health_score=7,
        prep_time_min=30,
    )
    defaults.update(overrides)
    m = MealPlan(**defaults)
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


def make_transaction(session: Session, **overrides) -> "Transaction":
    from models.transaction import Transaction
    defaults = dict(
        household_id="default",
        date=dt.date.today(),
        amount=-50.0,
        description="Test purchase",
        category="groceries",
    )
    defaults.update(overrides)
    t = Transaction(**defaults)
    session.add(t)
    session.commit()
    session.refresh(t)
    return t


def make_budget(session: Session, **overrides) -> "Budget":
    from models.budget import Budget
    today = dt.date.today()
    defaults = dict(
        household_id="default",
        month=f"{today.year}-{today.month:02d}",
        category="groceries",
        limit_amount=500.0,
    )
    defaults.update(overrides)
    b = Budget(**defaults)
    session.add(b)
    session.commit()
    session.refresh(b)
    return b


def make_activity(session: Session, **overrides) -> "Activity":
    from models.activity import Activity
    defaults = dict(
        household_id="default",
        date=dt.date.today(),
        activity_type="screen_free_family",
        duration_min=60,
        participants_count=2,
        points_earned=15,
        multipliers_applied=["2+ participants"],
    )
    defaults.update(overrides)
    a = Activity(**defaults)
    session.add(a)
    session.commit()
    session.refresh(a)
    return a


def make_goal(session: Session, **overrides) -> "PersonalGoal":
    from models.goal import PersonalGoal
    defaults = dict(
        household_id="default",
        member_id=1,
        title="Test Goal",
        category="learning",
        target_frequency="daily",
        points_per_completion=10,
        is_active=True,
    )
    defaults.update(overrides)
    g = PersonalGoal(**defaults)
    session.add(g)
    session.commit()
    session.refresh(g)
    return g


def make_goal_completion(session: Session, **overrides) -> "GoalCompletion":
    from models.goal import GoalCompletion
    defaults = dict(
        household_id="default",
        goal_id=1,
        member_id=1,
        date=dt.date.today(),
        points_earned=10,
    )
    defaults.update(overrides)
    gc = GoalCompletion(**defaults)
    session.add(gc)
    session.commit()
    session.refresh(gc)
    return gc


def make_chore(session: Session, **overrides) -> "Chore":
    from models.chore import Chore
    defaults = dict(
        household_id="default",
        title="Test Chore",
        points=5,
        frequency="daily",
        is_active=True,
    )
    defaults.update(overrides)
    c = Chore(**defaults)
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


def make_chore_completion(session: Session, **overrides) -> "ChoreCompletion":
    from models.chore import ChoreCompletion
    defaults = dict(
        household_id="default",
        chore_id=1,
        member_id=1,
        date=dt.date.today(),
        points_earned=5,
    )
    defaults.update(overrides)
    cc = ChoreCompletion(**defaults)
    session.add(cc)
    session.commit()
    session.refresh(cc)
    return cc


def make_presence(session: Session, **overrides) -> "PresenceSession":
    from models.presence import PresenceSession
    defaults = dict(
        household_id="default",
        planned_duration_min=30,
        status="active",
    )
    defaults.update(overrides)
    p = PresenceSession(**defaults)
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


def make_todo(session: Session, **overrides) -> "TodoItem":
    from models.todo import TodoItem
    defaults = dict(
        household_id="default",
        title="Test Todo",
        priority="medium",
        is_completed=False,
    )
    defaults.update(overrides)
    t = TodoItem(**defaults)
    session.add(t)
    session.commit()
    session.refresh(t)
    return t
