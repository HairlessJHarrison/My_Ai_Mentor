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
- `backend/main.py` — FastAPI app with CORS, lifespan handler, health check endpoint, WebSocket endpoint, all 6 routers registered
- `.env.example` — Template env file

**Models (all 7):**
- `backend/models/__init__.py` — Re-exports all models
- `backend/models/schedule.py` — ScheduleEvent, ScheduleEventCreate, ScheduleEventUpdate
- `backend/models/meal.py` — MealPlan, MealPlanCreate, MealPlanUpdate
- `backend/models/transaction.py` — Transaction, TransactionCreate
- `backend/models/budget.py` — Budget, BudgetCreate
- `backend/models/activity.py` — Activity, ActivityCreate
- `backend/models/presence.py` — PresenceSession, PresenceSessionCreate
- `backend/models/config.py` — HouseholdConfig, HouseholdConfigUpdate

#### Issues Fixed:
- Pydantic/SQLModel field name `date` clashed with the `date` type annotation — fixed with `import datetime as dt`
- SQLModel 0.0.37 `TypeError: issubclass() arg 1 must be a class` on `Literal[...]` fields — fixed by using `str` with `sa_column=Column(String)` in all 5 affected model files
- `database.py` default path `sqlite:///backend/data/unplugged.db` — fixed to `sqlite:///data/unplugged.db` for correct relative path
- `model_dump()` returned non-serializable `dt.time` objects — fixed with `model_dump(mode="json")` across all API files

---

### Phase 2: Schedule Module ✅

- `backend/services/free_block_finder.py` — Algorithm to find free time windows on a day or across multiple days, identifying which members are available
- `backend/api/schedules.py` — 7 endpoints:
  - `GET /api/v1/schedules/today` — Today's events + free block analysis
  - `GET /api/v1/schedules/week` — Weekly view with free blocks
  - `GET /api/v1/schedules/free-blocks` — Free time windows (next N days)
  - `POST /api/v1/schedules/events` — Create event
  - `PUT /api/v1/schedules/events/{id}` — Update event
  - `PUT /api/v1/schedules/events/{id}/protect` — Toggle protection
  - `DELETE /api/v1/schedules/events/{id}` — Delete event
- All mutations broadcast via WebSocket

---

### Phase 3: Meal Module ✅

- `backend/services/grocery_aggregator.py` — Deduplicates ingredients across meal plans, estimates per-item cost
- `backend/api/meals.py` — 6 endpoints:
  - `GET /api/v1/meals/plan` — Week or date view with cost/health summaries
  - `POST /api/v1/meals/plan` — Create meal plan entry
  - `PUT /api/v1/meals/plan/{id}` — Update meal plan
  - `DELETE /api/v1/meals/plan/{id}` — Delete meal plan
  - `GET /api/v1/meals/grocery-list` — Consolidated grocery list

---

### Phase 4: Budget Module ✅

- `backend/services/csv_importer.py` — Bank CSV parser with column alias mapping
- `backend/services/budget_forecaster.py` — Linear spending projection based on daily rate
- `backend/api/budgets.py` — 7 endpoints:
  - `GET /api/v1/budgets/summary` — Budget vs. actual by category
  - `POST /api/v1/budgets` — Create/update budget line
  - `GET /api/v1/budgets/transactions` — Filtered transaction list
  - `POST /api/v1/budgets/transactions` — Log a transaction
  - `POST /api/v1/budgets/import-csv` — Bulk CSV import
  - `GET /api/v1/budgets/forecast` — Spending forecast

---

### Phase 5: Scoring Module ✅

- `backend/services/scoring_engine.py` — Full PRD scoring rules:
  - Base points per activity type (10, 15, 8, 12, 20 pts/hr)
  - Multiplier conditions (2+ participants, streaks, protected blocks, home-cooked meals)
  - Highest applicable multiplier only (no stacking)
  - Daily caps per activity type
  - Streak detection (consecutive days)
  - Weekly trend aggregation
- `backend/api/scoring.py` — 4 endpoints:
  - `POST /api/v1/scoring/log-activity` — Server-side point calculation
  - `GET /api/v1/scoring/today` — Today's activities + total points
  - `GET /api/v1/scoring/trends` — Weekly trends
  - `GET /api/v1/scoring/streaks` — Active streaks

---

### Phase 6: Presence Module ✅

- `backend/api/presence.py` — 4 endpoints:
  - `POST /api/v1/presence/start` — Start unplugged session (prevents duplicates)
  - `POST /api/v1/presence/end` — End session + auto-log scored activity
  - `GET /api/v1/presence/current` — Get active session
  - `GET /api/v1/presence/stats` — Session statistics
- WebSocket broadcasts on start/end

---

### Phase 7: Config & Schema Export ✅

- `backend/schemas/exporter.py` — Exports JSON Schema for all 16 Pydantic models
- `backend/api/config.py` — 3 endpoints:
  - `GET /api/v1/config/household` — Get config (with defaults)
  - `PUT /api/v1/config/household` — Update/create config
  - `GET /api/v1/config/schema` — All model JSON Schemas for OpenClaw

---

## What Needs to Be Done Next

### Phase 8: React Frontend
- Scaffold React + Vite + Tailwind project in `frontend/`
- Create Dashboard with 5 cards (Schedule, Meal, Budget, Score, Unplugged button)
- Create UnpluggedMode full-screen overlay with countdown timer
- Create useWebSocket hook with reconnect logic
- Create stub view pages
- Dark mode, nature-inspired color palette

### Phase 9: Docker + Deployment
- Create `docker-compose.yml`, `docker-compose.dev.yml`
- Create `backend/Dockerfile`
- Create `nginx/nginx.conf`
- Create `openclaw-skill/skill.json` + README
- Create `scripts/setup.sh`, `scripts/backup.sh`, `scripts/seed.py`

---

## Tech Stack Reference
- **Backend:** Python 3.12, FastAPI 0.135.1, SQLModel 0.0.37, Pydantic 2.12.5, SQLite
- **Frontend:** React 18, Vite, TailwindCSS (not yet created)
- **Deployment:** Docker Compose, Nginx
- **Target:** Raspberry Pi 4B (8GB) — local-first, privacy-focused

## How to Run
```bash
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
# Then visit http://localhost:8000/docs for Swagger UI
```

## API Endpoint Summary (31 total)

| Module | Endpoints | Prefix |
|--------|-----------|--------|
| Health | 1 | `/api/v1/health` |
| Schedules | 7 | `/api/v1/schedules/` |
| Meals | 6 | `/api/v1/meals/` |
| Budgets | 7 | `/api/v1/budgets/` |
| Scoring | 4 | `/api/v1/scoring/` |
| Presence | 4 | `/api/v1/presence/` |
| Config | 3 | `/api/v1/config/` |
