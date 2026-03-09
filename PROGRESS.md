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

## What Needs to Be Done Next

### Scoring Engine Full Refactor (DEFERRED)
- Refactor `backend/services/scoring_engine.py` to award family activity points per participant member_id (not just household-wide)
- Add `participant_member_ids: list[int]` field to Activity model
- Update `POST /scoring/log-activity` to accept and store participant member IDs

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

## API Endpoint Summary (63 total)

| Module | Endpoints | Prefix |
|--------|-----------|--------|
| Health | 1 | `/api/v1/health` |
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
