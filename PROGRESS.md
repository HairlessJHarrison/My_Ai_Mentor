# Unplugged — Build Progress

## What Has Been Completed

### Phase 1: Backend Scaffolding ✅

All foundational files created and verified. Server starts successfully, health endpoint responds, and SQLite database is created with all 7 tables.

#### Files Created:

**Infrastructure:**
- `backend/requirements.txt` — All Python dependencies (fastapi, uvicorn, sqlmodel, apscheduler, etc.)
- `backend/database.py` — SQLModel engine setup with SQLite, `get_session` dependency, `create_db_and_tables()`
- `backend/auth.py` — Bearer token auth middleware (skips auth if no API_KEY env var set)
- `backend/websocket.py` — `ConnectionManager` class with connect/disconnect/broadcast methods
- `backend/main.py` — FastAPI app with CORS, lifespan handler, health check endpoint, WebSocket endpoint, all routers registered
- `.env.example` — Template env file

#### Issues Fixed:
- Pydantic/SQLModel field name `date` clashed with the `date` type annotation — fixed with `import datetime as dt`
- SQLModel 0.0.37 `TypeError: issubclass() arg 1 must be a class` on `Literal[...]` fields — fixed by using `str` with `sa_column=Column(String)` in all affected model files
- `database.py` default path `sqlite:///backend/data/unplugged.db` — fixed to `sqlite:///data/unplugged.db` for correct relative path
- `model_dump()` returned non-serializable `dt.time` objects — fixed with `model_dump(mode="json")` across all API files

---

### Phase 2: Schedule Module ✅
### Phase 3: Meal Module ✅
### Phase 4: Budget Module ✅
### Phase 5: Scoring Module ✅
### Phase 6: Presence Module ✅
### Phase 7: Config & Schema Export ✅
### Phase 8: React Frontend ✅
### Phase 9: Docker + Deployment ✅

*(See git history for detailed file lists of Phases 2–9)*

---

### Phase 10a: Member Profiles ✅

- `backend/models/member.py` — Member, MemberCreate, MemberUpdate models
- `backend/api/members.py` — 5 endpoints: CRUD + per-member score breakdown
- `backend/models/__init__.py` — Updated with all new model exports
- `backend/main.py` — Updated with members_router, goals_router, chores_router

---

### Phase 10b: Personal Goals System ✅

- `backend/models/goal.py` — PersonalGoal, GoalCompletion, PersonalGoalCreate/Update, GoalCompleteRequest
- `backend/api/goals.py` — 6 endpoints: CRUD + complete + progress with streak tracking
- `backend/services/goal_tracker.py` — Streak detection (x1.5 at 3+ days), per-goal progress aggregation

---

### Phase 10c: Chore System ✅

- `backend/models/chore.py` — Chore, ChoreCompletion, ChoreCreate/Update, ChoreCompleteRequest
- `backend/api/chores.py` — 7 endpoints: CRUD + complete + verify + daily status per member
- Parent verification enforced (only role="parent" members can verify)
- Chore status shows per-member completion with assignment filtering

---

### Phase 10d: Scoring Engine — Per-Member Score ✅

- `backend/api/members.py` — `GET /members/{id}/score` endpoint returns breakdown by source (activities, goals, chores)
- Points now tracked individually per member via GoalCompletion and ChoreCompletion tables

**Note:** `backend/services/scoring_engine.py` still awards family activity points at the household level. Full refactor to award per-participant is deferred to when the Activity model adds a `participant_member_ids` field.

---

### Phase 10e: Schedule Locations + Travel Time ✅

- `backend/models/schedule.py` — Added `location`, `travel_time_min`, `assigned_member_ids`, `google_event_id` fields; added `google_calendar` to source enum
- `backend/models/schedule.py` — ScheduleEventUpdate updated with new optional fields
- `backend/services/travel_time.py` — Google Maps Directions API integration
- `backend/api/schedules.py` — 3 new endpoints:
  - `GET /schedules/member/{member_id}` — Per-member calendar view
  - `GET /schedules/travel-time` — Calculate travel time between locations
  - `POST /schedules/events/{id}/auto-travel` — Auto-set travel time from Google Maps

---

### Phase 10g: Enhanced CSV Import ✅

- `backend/models/csv_mapping.py` — CsvColumnMapping, CsvColumnMappingCreate models
- `backend/services/csv_importer_v2.py` — Enhanced parser with explicit column mapping, amount sign inversion, skip rows
- `backend/api/budgets.py` — 4 new endpoints:
  - `GET /budgets/csv-mappings` — List saved mapping profiles
  - `POST /budgets/csv-mappings` — Save a mapping profile
  - `POST /budgets/import-csv` — Now supports `mapping_id` query param for saved profiles
  - `POST /budgets/import-csv/preview` — Preview parsed rows before committing

---

### Phase 10f: Google Calendar Two-Way Sync ✅

- `backend/services/google_calendar.py` — OAuth2 flow (auth URL, code exchange, token refresh), two-way sync (import/export/update), disconnect
- `backend/api/google_calendar.py` — 4 endpoints: auth-url, callback, sync, disconnect
- `backend/models/member.py` — Added `google_credentials` JSON field for per-member OAuth2 token storage
- `backend/requirements.txt` — Added `google-auth`, `google-auth-oauthlib`, `google-api-python-client`
- `backend/main.py` — Registered `google_calendar_router`
- Env vars needed: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

---

### Phase 10h: Frontend Updates ✅

- `frontend/src/context/HouseholdContext.jsx` — Added `members`, `goals`, `chores` state; fetches on load; WebSocket handlers for `goal_completed`, `chore_completed`, `chore_verified`, `calendar_synced`
- `frontend/src/views/GoalsView.jsx` — Per-member goal tracker with member tabs, streak indicators, create/complete forms
- `frontend/src/views/ChoresView.jsx` — Chore board with member tabs, checkbox toggles, parent verification
- `frontend/src/components/GoalCard.jsx` — Dashboard card with SVG progress gauge
- `frontend/src/components/ChoreCard.jsx` — Dashboard card with progress bar
- `frontend/src/components/CsvImportWizard.jsx` — 4-step modal: upload, mapping, preview, import
- `frontend/src/components/ScoreCard.jsx` — Updated with per-member selector, score breakdown (activities/goals/chores)
- `frontend/src/views/ScheduleView.jsx` — Added location display, travel time badge, member color dots
- `frontend/src/views/BudgetView.jsx` — Added Import CSV button with CsvImportWizard integration
- `frontend/src/components/Dashboard.jsx` — Added GoalCard and ChoreCard to grid (3-column on large screens)
- `frontend/src/App.jsx` — Added `/goals` and `/chores` routes

---

### Phase 10i: OpenClaw Skill Update ✅

- `openclaw-skill/skill.json` — Added 21 new tools (41 total): members (4), goals (5), chores (5), Google Calendar (4), CSV mappings (2), member schedule (1)

---

## Phase 10 Complete — All Sub-Phases Implemented

All backend APIs and frontend views for Phase 10 are implemented. The old database must be deleted when starting fresh (schema changed with new tables and columns).

**To start fresh:** `rm backend/data/unplugged.db` then restart the server.

---

### Phase 11: Automated Testing & Test Documentation ✅

Added comprehensive automated test suite with 182 tests at 96% code coverage, plus detailed manual testing instructions for features requiring external services or browser interaction.

#### Test Infrastructure:
- `backend/requirements-test.txt` — Test dependencies (pytest, pytest-asyncio, httpx, pytest-cov)
- `backend/tests/conftest.py` — Core fixtures with in-memory SQLite (`StaticPool`), FastAPI dependency overrides, 11 factory helpers (`make_member`, `make_event`, `make_meal`, `make_transaction`, `make_budget`, `make_activity`, `make_goal`, `make_goal_completion`, `make_chore`, `make_chore_completion`, `make_presence`)

#### Service Unit Tests (57 tests):
- `tests/services/test_free_block_finder.py` — 10 tests: no events, single event, overlapping, day boundaries, min block filter, multi-day
- `tests/services/test_grocery_aggregator.py` — 6 tests: dedup, cost aggregation, empty ingredients, sorted output
- `tests/services/test_budget_forecaster.py` — 5 tests: linear projection, year boundary, positive transactions ignored
- `tests/services/test_csv_importer.py` — 11 tests: standard CSV, column aliases, amount cleaning, explicit mapping, sign invert, skip rows, preview
- `tests/services/test_scoring_engine.py` — 14 tests: all activity types, multipliers, daily caps, streaks, weekly trends
- `tests/services/test_goal_tracker.py` — 5 tests: goal points, streak multiplier at 3+ days, progress tracking
- `tests/services/test_travel_time.py` — 3 tests: mocked Google Maps API (no key raises, success, error)

#### API Endpoint Tests (109 tests):
- `tests/test_health.py` — 1 test
- `tests/test_auth.py` — 4 tests: dev mode bypass, auth required, valid/invalid key
- `tests/test_config.py` — 4 tests: default config, create, update, schema export
- `tests/test_members.py` — 11 tests: CRUD, validation, score breakdown
- `tests/test_schedules.py` — 17 tests: events CRUD, today/week views, free blocks, protect, member filter, travel time (mocked)
- `tests/test_meals.py` — 10 tests: CRUD, health score validation, grocery list aggregation
- `tests/test_budgets.py` — 15 tests: summary, upsert, transactions, CSV mappings, CSV import, preview, forecast
- `tests/test_scoring.py` — 6 tests: log activity, multipliers, today's activities, trends, streaks
- `tests/test_presence.py` — 8 tests: start/end sessions, conflict 409, auto-logged activity, stats
- `tests/test_goals.py` — 12 tests: CRUD, soft delete, complete with points, streak multiplier, inactive 400, progress
- `tests/test_chores.py` — 15 tests: CRUD, soft delete, complete, parent verify, child verify rejected 403, daily status
- `tests/test_google_calendar.py` — 11 tests: all mocked (auth URL, callback, sync, disconnect)

#### WebSocket & Auth Tests (9 tests):
- `tests/test_websocket.py` — 5 tests: connect, ConnectionManager broadcast, multiple clients, dead connection cleanup
- `tests/test_auth.py` — 4 tests

#### Manual Testing Documentation:
- `backend/TESTING.md` — Comprehensive guide with curl commands for Google OAuth2 flow, Google Maps travel time, frontend UI checklists (10 views), Docker deployment, Raspberry Pi performance, API authentication

#### Test Coverage Summary:

| Module | Tests | Coverage |
|--------|-------|----------|
| Services (pure functions) | 57 | 86-100% |
| API Endpoints | 109 | 93-100% |
| Auth | 4 | 100% |
| WebSocket | 5 | 100% |
| Health | 1 | 100% |
| Models | — | 100% |
| **Total** | **182** | **96%** |

#### How to Run Tests:
```bash
cd backend
pip install -r requirements-test.txt
PYTHONPATH=. pytest tests/ -v --tb=short
PYTHONPATH=. pytest tests/ -v --cov=. --cov-report=term-missing
```

---

## What Needs to Be Done Next

### Scoring Engine Full Refactor ✅ (COMPLETED)
- Added `participant_member_ids: list[int]` field to Activity model
- Updated `POST /scoring/log-activity` to accept and store participant member IDs
- Auto-infers `participants_count` from member ID list length
- Updated `GET /members/{id}/score` to filter activities by participant membership
- Added database migration for `participant_member_ids` column

---

### Phase 12: AI Data Interfaces ✅

Made the application discoverable and consumable by AI agents/LLMs:

**Files Created:**
- `frontend/public/llms.txt` — AI agent instructions with auth, quick-start, and module table
- `frontend/public/llms-full.txt` — Complete API reference with every endpoint documented
- `frontend/public/robots.txt` — AI crawler directives
- `backend/api/ai_context.py` — `GET /api/v1/ai/context` consolidated snapshot endpoint

**Files Modified:**
- `frontend/index.html` — Added `llms-txt` meta tag and OpenAPI alternate link
- `nginx/nginx.conf` — Added proxy blocks for `/docs`, `/redoc`, `/openapi.json`, `/skill.json`
- `docker-compose.yml` — Added `skill.json` volume mount to Nginx container
- `backend/main.py` — Enriched OpenAPI metadata (tags, descriptions, contact, license)
- `openclaw-skill/skill.json` — Added `get_ai_context` tool as first entry

---

### Phase 13: V1.0 Features ✅

**Schema-Driven Forms:**
- `frontend/src/components/SchemaForm.jsx` — Reusable component that dynamically renders form fields from JSON Schema fetched from `/api/v1/config/schema`

**Weekly Reflection View:**
- `frontend/src/views/ReflectionView.jsx` — Weekly narrative display, week-over-week comparison, per-member score progress bars, and 4-week trend chart
- Added `/reflection` route to `App.jsx`
- Added "View Weekly Reflection" link to ScoreCard dashboard component

**PWA Offline Support:**
- `frontend/public/manifest.json` — PWA manifest with dark theme and standalone display
- `frontend/public/sw.js` — Service worker with network-first API caching and cache-first static assets
- Registered service worker in `index.html`

**Auth Hardening & Rate Limiting:**
- Rewrote `backend/auth.py` with in-memory rate limiting (configurable via `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_WINDOW` env vars)
- Clear error messages: 401 for missing key, 403 for invalid key, 429 with `Retry-After` header for rate limit

---

## Tech Stack Reference
- **Backend:** Python 3.12, FastAPI 0.135.1, SQLModel 0.0.37, Pydantic 2.12.5, SQLite
- **Frontend:** React 19, Vite 7, Tailwind CSS 4, React Router 7
- **Deployment:** Docker Compose, Nginx
- **External APIs (Phase 10):** Google Calendar API, Google Maps Directions API
- **Target:** Raspberry Pi 4B (8GB) — local-first, privacy-focused

## How to Run
```bash
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
# Then visit http://localhost:8000/docs for Swagger UI
```

## API Endpoint Summary (65 total)

| Module | Endpoints | Prefix |
|--------|-----------|--------|
| Health | 1 | `/api/v1/health` |
| AI Context | 1 | `/api/v1/ai/` |
| Schedules | 10 | `/api/v1/schedules/` |
| Meals | 6 | `/api/v1/meals/` |
| Budgets | 11 | `/api/v1/budgets/` |
| Scoring | 4 | `/api/v1/scoring/` |
| Presence | 4 | `/api/v1/presence/` |
| Config | 3 | `/api/v1/config/` |
| Members | 5 | `/api/v1/members/` |
| Goals | 6 | `/api/v1/goals/` |
| Chores | 7 | `/api/v1/chores/` |
| Google Calendar | 4 | `/api/v1/google-calendar/` |
| WebSocket | 1 | `/ws` |

