# Unplugged — Test Suite Documentation

> **210 tests · 0 failures · Python 3.12 + pytest 9.x**
> Last verified: 2026-03-16

---

## Quick Start

```bash
cd backend
pip install -r requirements-test.txt       # one-time
PYTHONPATH=. pytest tests/ -v --tb=short   # run all
```

### Useful Variations

| Goal | Command |
|------|---------|
| Run all tests | `PYTHONPATH=. pytest tests/ -v` |
| Run one module | `PYTHONPATH=. pytest tests/test_meals.py -v` |
| Run one class | `PYTHONPATH=. pytest tests/test_scoring.py::TestLogActivity -v` |
| Run one test | `PYTHONPATH=. pytest tests/test_scoring.py::TestLogActivity::test_log -v` |
| Stop on first fail | `PYTHONPATH=. pytest tests/ -x --tb=short` |
| With coverage | `PYTHONPATH=. pytest tests/ -v --cov=. --cov-report=term-missing` |
| Only new tests | `PYTHONPATH=. pytest tests/test_ai_context.py tests/test_scoring_member_ids.py tests/test_auth_v2.py tests/test_schema_form.py -v` |

> **Windows PowerShell:** Use `$env:PYTHONPATH = "."` before pytest instead of the `PYTHONPATH=.` prefix.

---

## Test Architecture

### Infrastructure (`conftest.py`)

- **In-memory SQLite** via `StaticPool` — each test gets fresh tables (created before, dropped after).
- **Rate limit cleanup** — `_clear_rate_limits` autouse fixture clears `auth._request_counts` between tests.
- **Factory helpers** — `make_member()`, `make_event()`, `make_meal()`, etc. create pre-populated model instances with sensible defaults. Override any field via kwargs.

### Conventions

- Tests are **class-based** grouped by endpoint or concern (e.g., `TestCreateMember`, `TestDeleteMember`).
- Each test method starts with `test_` and describes the scenario.
- Tests use the `client` fixture (HTTPX `TestClient`) for API endpoint tests.
- Tests use the `session` fixture for direct database operations.
- Pure service logic tests live in `tests/services/`.

---

## Test Inventory (210 tests)

### Services — Pure Business Logic (57 tests)

| File | Class | Tests | What it covers |
|------|-------|-------|----------------|
| `test_budget_forecaster.py` | `TestForecastSpending` | 5 | Linear spending projection, multi-month, boundary cases |
| `test_csv_importer.py` | `TestParseCsv` | 8 | Standard CSV, column aliases, empty rows, amount cleaning |
| | `TestParseCsvWithMapping` | 4 | Explicit mapping, sign inversion, skip rows |
| | `TestPreviewCsv` | 2 | Preview row limit, no-transaction warning |
| `test_free_block_finder.py` | `TestFindFreeBlocks` | 7 | No events, single event, overlapping events, min block filter |
| | `TestFindFreeBlocksMultiDay` | 3 | Multi-day ranges, overlapping member tracking |
| `test_goal_tracker.py` | `TestCalculateGoalPoints` | 3 | Base points, streak multiplier, edge cases |
| | `TestGetGoalProgress` | 2 | Empty progress, progress with completions |
| `test_grocery_aggregator.py` | `TestAggregateGroceryList` | 6 | Deduplication, cost aggregation, sorting |
| `test_scoring_engine.py` | `TestCalculatePoints` | 10 | All activity types, multipliers, daily cap |
| | `TestGetStreaks` | 2 | No streaks, streak detection |
| | `TestGetWeeklyTrends` | 2 | Empty trends, trends with data |
| `test_travel_time.py` | `TestCalculateTravelTime` | 3 | No API key, success, API error |

---

### API Endpoints (153 tests)

| File | Class | Tests | What it covers |
|------|-------|-------|----------------|
| **AI Context** | | | |
| `test_ai_context.py` | `TestAiContext` | 11 | Empty context, members, schedule, meals, budget, scoring, presence active/inactive, chores pending/completed, date filtering |
| **Auth & Rate Limiting** | | | |
| `test_auth.py` | `TestAuth` | 4 | Dev mode bypass, key required, valid key, invalid key (403) |
| `test_auth_v2.py` | `TestAuthErrorMessages` | 4 | 401 missing key, 403 invalid key, 200 valid key, dev mode |
| | `TestRateLimiting` | 3 | Under limit, exceeded (429 + Retry-After), per-IP isolation |
| **Budgets** | | | |
| `test_budgets.py` | `TestGetSummary` | 3 | Empty, with data, unbudgeted category |
| | `TestCreateBudget` | 2 | Create, upsert |
| | `TestTransactions` | 2 | Create & list, category filter |
| | `TestCsvMappings` | 1 | Create and list mappings |
| | `TestCsvImport` | 3 | Auto-detect, bad mapping, preview |
| | `TestForecast` | 2 | Empty, with transactions |
| **Chores** | | | |
| `test_chores.py` | `TestListChores` | 2 | Empty, only active |
| | `TestCreateChore` | 1 | Create |
| | `TestUpdateChore` | 2 | Update, not found |
| | `TestDeleteChore` | 2 | Soft delete, not found |
| | `TestCompleteChore` | 3 | Complete, not found, inactive |
| | `TestVerifyChore` | 4 | Parent verify, child rejected, not found, missing verified_by |
| | `TestChoreStatus` | 3 | Empty, with data, custom date |
| **Config** | | | |
| `test_config.py` | `TestConfig` | 4 | Get default, PUT creates, PUT updates, GET schema |
| **Goals** | | | |
| `test_goals.py` | `TestListGoals` | 2 | Empty, filter by member |
| | `TestCreateGoal` | 2 | Create, invalid category |
| | `TestUpdateGoal` | 2 | Update, not found |
| | `TestDeleteGoal` | 2 | Soft delete, not found |
| | `TestCompleteGoal` | 4 | Complete, not found, inactive, streak multiplier |
| | `TestGetProgress` | 1 | Progress endpoint |
| **Google Calendar** | | | |
| `test_google_calendar.py` | `TestAuthUrl` | 3 | Not found, success, missing env |
| | `TestCallback` | 3 | Success, invalid code, not found |
| | `TestSync` | 4 | Not found, no creds, success, sync failure |
| | `TestDisconnect` | 2 | Success, not found |
| **Health** | | | |
| `test_health.py` | — | 1 | Returns OK |
| **Meals** | | | |
| `test_meals.py` | `TestGetPlan` | 3 | Empty, with meals, specific date |
| | `TestCreatePlan` | 2 | Create, health score validation |
| | `TestUpdatePlan` | 2 | Update, not found |
| | `TestDeletePlan` | 2 | Delete, not found |
| | `TestGroceryList` | 2 | Empty, aggregation |
| **Members** | | | |
| `test_members.py` | `TestListMembers` | 2 | Empty, returns created |
| | `TestCreateMember` | 3 | Create, missing name, invalid role |
| | `TestUpdateMember` | 2 | Update, not found |
| | `TestDeleteMember` | 2 | Delete, not found |
| | `TestMemberScore` | 3 | No activities, with data, not found |
| **Presence** | | | |
| `test_presence.py` | `TestStartSession` | 2 | Start, conflict |
| | `TestEndSession` | 2 | End, none active |
| | `TestGetCurrent` | 2 | Active, none |
| | `TestGetStats` | 2 | Empty, with sessions |
| **Schedules** | | | |
| `test_schedules.py` | `TestGetToday` | 2 | Empty, with events |
| | `TestGetWeek` | 2 | Default week, custom start |
| | `TestFreeBlocks` | 2 | Default, custom days |
| | `TestCreateEvent` | 1 | Create |
| | `TestUpdateEvent` | 2 | Update, not found |
| | `TestProtectEvent` | 2 | Protect, not found |
| | `TestDeleteEvent` | 2 | Delete, not found |
| | `TestMemberSchedule` | 1 | Filter by member |
| | `TestTravelTime` | 2 | Mocked, no API key |
| | `TestAutoTravelTime` | 3 | Auto travel, no location, not found |
| **Schema** | | | |
| `test_schema_form.py` | `TestSchemaEndpoint` | 3 | Returns models, has properties, ActivityCreate has member_ids |
| **Scoring** | | | |
| `test_scoring.py` | `TestLogActivity` | 2 | Log, log with multiplier |
| | `TestGetToday` | 2 | Empty, with activity |
| | `TestTrends` | 1 | Trends |
| | `TestStreaks` | 1 | Streaks |
| `test_scoring_member_ids.py` | `TestLogActivityWithMemberIds` | 4 | With IDs, without IDs, empty list, multiplier with IDs |
| | `TestMemberScoreWithMemberIds` | 3 | Per-member filter, shared activity, legacy backward compat |
| **WebSocket** | | | |
| `test_websocket.py` | `TestWebSocket` | 1 | Connect |
| | `TestConnectionManager` | 4 | Connect/disconnect, broadcast, multiple clients, dead cleanup |

---

## Adding Tests for New Features

### 1. Create a new test file

```
backend/tests/test_<module>.py
```

### 2. Use the factory helpers

```python
from tests.conftest import make_member, make_event, make_activity  # etc.

class TestMyNewFeature:
    def test_something(self, client, session):
        member = make_member(session, name="Alice")
        resp = client.get(f"/api/v1/my-endpoint/{member.id}")
        assert resp.status_code == 200
```

### 3. Available factory helpers

| Helper | Creates | Key defaults |
|--------|---------|--------------|
| `make_member(session, **kw)` | `Member` | name="Test User", role="parent" |
| `make_event(session, **kw)` | `ScheduleEvent` | today 9-10am, title="Test Event" |
| `make_meal(session, **kw)` | `MealPlan` | dinner, "Test Recipe", eggs+cheese |
| `make_transaction(session, **kw)` | `Transaction` | -$50, groceries, today |
| `make_budget(session, **kw)` | `Budget` | groceries, $500 limit, current month |
| `make_activity(session, **kw)` | `Activity` | screen_free_family, 60min, 15pts |
| `make_goal(session, **kw)` | `PersonalGoal` | daily learning goal, 10pts |
| `make_goal_completion(session, **kw)` | `GoalCompletion` | today, 10pts |
| `make_chore(session, **kw)` | `Chore` | daily, 5pts, active |
| `make_chore_completion(session, **kw)` | `ChoreCompletion` | today, 5pts |
| `make_presence(session, **kw)` | `PresenceSession` | 30min, active |

### 4. Test pattern: auth-protected endpoint

```python
def test_requires_auth(self, client):
    from unittest.mock import patch
    with patch("auth.API_KEY", "secret"):
        resp = client.get("/api/v1/my-endpoint")
        assert resp.status_code == 401
```

### 5. Run just your new tests

```bash
PYTHONPATH=. pytest tests/test_my_feature.py -v --tb=short
```

---

## Known Warnings

All 242 warnings are `DeprecationWarning: datetime.datetime.utcnow()` from Pydantic/SQLModel defaults. These are harmless and will resolve when upgrading to timezone-aware datetimes in a future release.
