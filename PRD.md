# Unplugged — Product Requirements Document

> **Version:** 3.0 | **Date:** March 2026 | **Status:** MVP Complete — Phase 2 Features In Progress
>
> **One-liner:** A household data platform and visual dashboard hosted on a Raspberry Pi 4B (8GB), serving as the knowledge base and tool layer for an OpenClaw autonomous AI agent to manage schedules, meals, budgets, and presence scoring — all in service of maximizing screen-free family time.

---

## 1. Product Overview

### 1.1 What Unplugged Is

Unplugged is a **web application** (React frontend + FastAPI backend + SQLite database) that serves two consumers simultaneously:

1. **Family members** who view a beautiful, glanceable dashboard on any device (phone, tablet, laptop) on the local network.
2. **An OpenClaw autonomous agent** that reads from and writes to the system via a structured REST API, using it as an AgentSkill.

Unplugged does **not** host or run any AI model. It does **not** provide a chat interface. It is the **knowledge base**, the **tool layer**, and the **visual surface**. OpenClaw is the brain.

### 1.2 What Unplugged Is NOT

- **Not an AI runtime.** No LLM runs on the Pi. OpenClaw connects to its own LLM provider (Claude, GPT, DeepSeek) separately.
- **Not a messaging interface.** Users chat with OpenClaw via Signal, Telegram, Discord, or WhatsApp. OpenClaw calls the Unplugged API to fulfill requests.
- **Not a smart home controller.** If OpenClaw wants to trigger DND on devices, that's a separate OpenClaw skill (e.g., Home Assistant). Unplugged only stores data.

### 1.3 Design Philosophy

- **The best interface is the one you never have to open.** Unplugged succeeds when families spend less time in the app and more time together.
- **Local-first privacy.** All family data lives on hardware you own.
- **LLM-native data.** Every data structure is JSON Schema with descriptive field names, making the entire system readable and modifiable by any LLM via the API.
- **Ambient over interactive.** The dashboard runs silently. Notifications are rare, purposeful, and biased toward getting you offline.

### 1.4 Core Success Metric

**Hours of protected screen-free time per household per week, trending upward.** Unplugged measures it. OpenClaw drives it.

---

## 2. System Architecture

### 2.1 Separation of Concerns

```
┌─────────────────────────────────────────────────┐
│  FAMILY MEMBERS                                 │
│  (Phone / Tablet / Laptop on local network)     │
└───────────────────────┬─────────────────────────┘
                        │
                   [View Dashboard]
                        │
┌───────────────────────┴─────────────────────────┐
│  RASPBERRY PI 4B (8GB)                          │
│  ┌───────────────────────────────────────────┐  │
│  │  Nginx (reverse proxy + static frontend)  │  │
│  └─────────────────────┬─────────────────────┘  │
│                        │                         │
│  ┌─────────────────────┴─────────────────────┐  │
│  │  FastAPI Backend                          │  │
│  │    /api/v1/schedules                      │  │
│  │    /api/v1/meals                          │  │
│  │    /api/v1/budgets                        │  │
│  │    /api/v1/scoring                        │  │
│  │    /api/v1/presence                       │  │
│  │    /ws (WebSocket for live dashboard)     │  │
│  └─────────────────────┬─────────────────────┘  │
│                        │                         │
│  ┌─────────────────────┴─────────────────────┐  │
│  │  SQLite Database (unplugged.db)           │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  OPENCLAW (runs separately — any machine)       │
│  Connects to LLM (Claude / GPT / DeepSeek)      │
│  Connects to messaging (Signal / Telegram / etc) │
│  Calls Unplugged API as an AgentSkill            │
└─────────────────────────────────────────────────┘
```

### 2.2 Two Consumers, One Data Layer

Every piece of the system serves exactly two consumers:

| Module | Human (Dashboard) | OpenClaw (API) |
|--------|-------------------|----------------|
| Schedules | Visual calendar with color-coded events and protected time blocks | `GET /api/v1/schedules/free-blocks` returns JSON array of available windows |
| Meals | Weekly meal plan cards with recipe details and grocery list | `POST /api/v1/meals/plan` accepts structured JSON to create/update plans |
| Budgets | Category bar charts, spending vs. budget, trend lines | `GET /api/v1/budgets/summary` returns category totals and remaining amounts |
| Scoring | Presence score gauge, streaks, weekly reflection narrative | `POST /api/v1/scoring/log-activity` writes scored events |
| Presence | Full-screen unplugged mode with countdown and activity suggestion | `POST /api/v1/presence/start` triggers unplugged mode on all connected clients |

---

## 3. Technology Stack

### 3.1 Required Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Frontend** | React 18 + Vite + TailwindCSS, served as static PWA by Nginx | PWA = no app store. Tailwind = consistent design. Vite = fast builds on ARM64. |
| **API Server** | FastAPI (Python 3.11+) with Pydantic v2 | Pydantic models auto-generate JSON Schema for API validation AND OpenClaw skill definitions. This is the linchpin. |
| **ORM** | SQLModel | Wraps SQLAlchemy with Pydantic integration. Switching from SQLite to PostgreSQL is one config change. |
| **Database** | SQLite (single file, zero-config) | Perfect for single-household Pi deployment. JSON columns for flexible nested data. |
| **Real-time** | WebSocket (FastAPI native) | Push updates to dashboard when OpenClaw modifies data. No polling. |
| **Task Scheduler** | APScheduler (in-process) | Daily free-block analysis, automated backups. Runs inside the API process. |
| **Auth** | API key (Phase 1, local network) | Simple bearer token in request header. JWT + OAuth2 for Phase 2 cloud. |
| **Containerization** | Docker Compose (ARM64 images) | Two containers: Nginx + FastAPI. Identical topology for Pi and cloud. |
| **Reverse Proxy** | Nginx | Serves static React build, proxies `/api/*` to FastAPI, handles WebSocket upgrade. |

### 3.2 Resource Budget (Pi 4B 8GB)

| Service | RAM | Notes |
|---------|-----|-------|
| Nginx | ~30 MB | Static files + reverse proxy |
| FastAPI (2 Uvicorn workers) | ~150 MB | API + WebSocket + APScheduler |
| SQLite | ~50 MB | In-process, file-based |
| Docker overhead | ~200 MB | Container runtime |
| **TOTAL** | **~450 MB** | **Leaves ~7.5 GB free** |

This means the Pi can also run OpenClaw (~200–400 MB) alongside Unplugged if the user wants a single-box setup.

---

## 4. Data Models

### 4.1 The Pydantic-Everywhere Pattern

**CRITICAL ARCHITECTURAL RULE:** Every data entity is defined as a single Pydantic/SQLModel class that simultaneously serves as:

1. **Database schema** — SQLModel creates the SQLite table.
2. **API contract** — FastAPI uses the model for request/response validation and auto-generated OpenAPI docs.
3. **LLM tool schema** — The model's JSON Schema is exported for the OpenClaw skill definition.

**One source of truth. Three consumers. Zero drift.**

All field names must be **descriptive and human-readable** (e.g., `health_score` not `hs`, `prep_time_min` not `ptm`). LLMs perform significantly better with clear field names.

All field definitions must include a `description` parameter for JSON Schema documentation.

### 4.2 Data Models to Implement

#### Schedule Event

```python
class ScheduleEvent(SQLModel, table=True):
    __tablename__ = "schedules"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier")
    date: date = Field(description="Event date", index=True)
    start_time: time = Field(description="Event start time")
    end_time: time = Field(description="Event end time")
    title: str = Field(description="Event title")
    event_type: Literal["appointment", "work", "school", "social", "errand", "protected_time", "other"] = Field(description="Category of event")
    is_protected: bool = Field(default=False, description="Whether this is a protected screen-free block")
    participants: list[str] = Field(default=[], sa_column=Column(JSON), description="List of household members involved")
    assigned_member_ids: list[int] = Field(default=[], sa_column=Column(JSON), description="Member IDs assigned to this event (Phase 10)")
    location: str | None = Field(default=None, description="Event location (address or place name)")
    travel_time_min: int | None = Field(default=None, description="Travel time in minutes (manual or auto-calculated via Google Maps)")
    google_event_id: str | None = Field(default=None, description="Google Calendar event ID for two-way sync")
    recurrence_rule: dict | None = Field(default=None, sa_column=Column(JSON), description="iCal RRULE as JSON, null if one-time")
    source: Literal["manual", "caldav_import", "google_calendar", "openclaw"] = Field(default="manual", description="How this event was created")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

#### Meal Plan

```python
class MealPlan(SQLModel, table=True):
    __tablename__ = "meal_plans"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier")
    date: date = Field(description="Meal date", index=True)
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"] = Field(description="Type of meal")
    recipe_name: str = Field(description="Recipe title")
    ingredients: list[str] = Field(sa_column=Column(JSON), description="List of ingredients")
    est_cost: float = Field(description="Estimated cost in USD")
    health_score: int = Field(ge=1, le=10, description="Health rating from 1 (least healthy) to 10 (most healthy)")
    prep_time_min: int = Field(description="Preparation time in minutes")
    nutrition_data: dict | None = Field(default=None, sa_column=Column(JSON), description="Optional macros: {calories, protein_g, carbs_g, fat_g}")
    notes: str | None = Field(default=None, description="Additional notes or instructions")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

#### Transaction

```python
class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier")
    date: date = Field(description="Transaction date", index=True)
    amount: float = Field(description="Transaction amount (negative for expenses, positive for income)")
    description: str = Field(description="Transaction description from bank or manual entry")
    category: str = Field(description="Budget category: groceries, dining, transport, utilities, entertainment, health, housing, other")
    subcategory: str | None = Field(default=None, description="Optional subcategory for finer tracking")
    tags: list[str] = Field(default=[], sa_column=Column(JSON), description="Freeform tags for search")
    merchant_meta: dict | None = Field(default=None, sa_column=Column(JSON), description="Optional merchant details")
    source: Literal["manual", "csv_import", "openclaw", "plaid"] = Field(default="manual", description="How this transaction was created")
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

#### Budget

```python
class Budget(SQLModel, table=True):
    __tablename__ = "budgets"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier")
    month: str = Field(description="Budget month in YYYY-MM format", index=True)
    category: str = Field(description="Budget category matching transaction categories")
    limit_amount: float = Field(description="Monthly budget limit in USD")
    notes: str | None = Field(default=None, description="Optional notes about this budget line")
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

#### Activity (Scoring)

```python
class Activity(SQLModel, table=True):
    __tablename__ = "activities"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier")
    date: date = Field(description="Activity date", index=True)
    activity_type: Literal["screen_free_family", "outdoor", "shared_meal", "game_creative", "one_on_one", "other"] = Field(description="Type of scored activity")
    duration_min: int = Field(description="Duration of activity in minutes")
    participants_count: int = Field(ge=1, description="Number of household members who participated")
    points_earned: int = Field(description="Calculated points (server-side based on scoring rules)")
    details: dict | None = Field(default=None, sa_column=Column(JSON), description="Freeform details about the activity")
    multipliers_applied: list[str] = Field(default=[], sa_column=Column(JSON), description="List of multiplier names that were applied")
    source: Literal["manual", "openclaw"] = Field(default="manual", description="How this activity was logged")
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

#### Presence Session

```python
class PresenceSession(SQLModel, table=True):
    __tablename__ = "presence_sessions"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier")
    start_time: datetime = Field(description="When unplugged session started")
    end_time: datetime | None = Field(default=None, description="When unplugged session ended, null if active")
    planned_duration_min: int = Field(description="Intended duration in minutes")
    status: Literal["active", "completed", "cancelled"] = Field(default="active", description="Session status")
    suggested_activity: str | None = Field(default=None, description="Activity suggestion shown on the unplugged screen")
    participant_devices: list[str] = Field(default=[], sa_column=Column(JSON), description="Devices that entered unplugged mode")
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

#### Household Config

```python
class HouseholdConfig(SQLModel, table=True):
    __tablename__ = "household_config"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(unique=True, description="Household identifier")
    household_name: str = Field(description="Display name for the household")
    members: list[dict] = Field(sa_column=Column(JSON), description="List of {name, role, dietary_restrictions[]}")
    health_goals: list[str] = Field(default=[], sa_column=Column(JSON), description="Household health goals: lower_sodium, high_protein, etc.")
    dietary_restrictions: list[str] = Field(default=[], sa_column=Column(JSON), description="Allergies and restrictions: gluten_free, nut_free, vegan, etc.")
    preferences: dict = Field(default={}, sa_column=Column(JSON), description="Freeform preferences: {favorite_cuisines[], default_meal_budget, etc.}")
    weekly_reflection_narrative: str | None = Field(default=None, description="Latest weekly narrative written by OpenClaw")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

#### Member (Phase 10 — NEW)

```python
class Member(SQLModel, table=True):
    __tablename__ = "members"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier", index=True)
    name: str = Field(description="Display name")
    role: Literal["parent", "child"] = Field(description="Role in the household")
    age: int | None = Field(default=None, description="Age of the member")
    color: str = Field(default="#22c55e", description="Hex color for calendar/UI display")
    avatar: str | None = Field(default=None, description="Avatar image URL or emoji")
    google_calendar_id: str | None = Field(default=None, description="Google Calendar ID for sync")
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

#### PersonalGoal (Phase 10 — NEW)

```python
class PersonalGoal(SQLModel, table=True):
    __tablename__ = "personal_goals"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier")
    member_id: int = Field(foreign_key="members.id", description="Which family member owns this goal")
    title: str = Field(description="Goal title, e.g. 'Practice piano', 'Read 30 minutes', 'Run 1 mile'")
    category: Literal["learning", "fitness", "creativity", "mindfulness", "health", "other"] = Field(description="Goal category")
    target_frequency: Literal["daily", "weekdays", "weekly", "custom"] = Field(default="daily", description="How often this goal should be completed")
    points_per_completion: int = Field(default=10, description="Points earned each time this goal is completed")
    is_active: bool = Field(default=True, description="Whether this goal is currently being tracked")
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

#### GoalCompletion (Phase 10 — NEW)

```python
class GoalCompletion(SQLModel, table=True):
    __tablename__ = "goal_completions"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier")
    goal_id: int = Field(foreign_key="personal_goals.id", description="Which goal was completed")
    member_id: int = Field(foreign_key="members.id", description="Who completed it")
    date: date = Field(description="Date of completion", index=True)
    duration_min: int | None = Field(default=None, description="Optional duration in minutes")
    notes: str | None = Field(default=None, description="Optional notes about the completion")
    points_earned: int = Field(description="Points earned (from goal config + any multipliers)")
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

#### Chore (Phase 10 — NEW)

```python
class Chore(SQLModel, table=True):
    __tablename__ = "chores"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier")
    title: str = Field(description="Chore name, e.g. 'Make bed', 'Wash dishes', 'Take out trash'")
    points: int = Field(description="Points earned for completing this chore")
    assigned_member_ids: list[int] = Field(default=[], sa_column=Column(JSON), description="Member IDs this chore is assigned to (empty = anyone)")
    frequency: Literal["daily", "weekly", "as_needed"] = Field(default="daily", description="How often this chore resets")
    is_active: bool = Field(default=True, description="Whether this chore is currently active")
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

#### ChoreCompletion (Phase 10 — NEW)

```python
class ChoreCompletion(SQLModel, table=True):
    __tablename__ = "chore_completions"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier")
    chore_id: int = Field(foreign_key="chores.id", description="Which chore was completed")
    member_id: int = Field(foreign_key="members.id", description="Who completed it")
    date: date = Field(description="Date of completion", index=True)
    verified_by: int | None = Field(default=None, foreign_key="members.id", description="Parent who verified (optional)")
    points_earned: int = Field(description="Points earned")
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

#### CsvColumnMapping (Phase 10 — NEW)

```python
class CsvColumnMapping(SQLModel, table=True):
    __tablename__ = "csv_column_mappings"

    id: int | None = Field(default=None, primary_key=True)
    household_id: str = Field(description="Household identifier")
    name: str = Field(description="Mapping profile name, e.g. 'Chase Checking', 'Amex Credit'")
    account_type: Literal["checking", "credit_card", "savings"] = Field(description="Type of bank account")
    column_map: dict = Field(sa_column=Column(JSON), description="Maps CSV columns to fields: {date_col, amount_col, description_col, category_col?, skip_rows?, date_format?}")
    amount_sign: Literal["as_is", "invert"] = Field(default="as_is", description="Whether to invert amount sign (some banks use positive for debits)")
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

---

## 5. API Specification

### 5.1 Conventions

- **RESTful and predictable.** GET = read, POST = create, PUT = update, DELETE = remove.
- **JSON in, JSON out.** Every request body and response is JSON validated by Pydantic.
- **Auth:** `Authorization: Bearer <API_KEY>` header on all requests.
- **Errors:** All errors return `{"error": "string", "detail": "string", "field": "string|null"}`.
- **WebSocket:** `/ws` endpoint pushes typed events to connected dashboard clients when data changes.

### 5.2 Endpoints

#### Schedules

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/v1/schedules/today` | All events for today with free block analysis | — | `{events: ScheduleEvent[], free_blocks: [{start, end, duration_min}]}` |
| GET | `/api/v1/schedules/week?start_date=YYYY-MM-DD` | Events for a given week | — | `{events: ScheduleEvent[], free_blocks: [...]}` |
| GET | `/api/v1/schedules/free-blocks?days=7` | Free time windows for next N days across all household members | — | `[{date, start, end, duration_min, overlapping_members[]}]` |
| POST | `/api/v1/schedules/events` | Create a new event | `ScheduleEvent` (without id) | Created `ScheduleEvent` |
| PUT | `/api/v1/schedules/events/{id}` | Update an existing event | Partial `ScheduleEvent` | Updated `ScheduleEvent` |
| PUT | `/api/v1/schedules/events/{id}/protect` | Mark/unmark a time block as protected | `{is_protected: bool}` | Updated `ScheduleEvent` |
| DELETE | `/api/v1/schedules/events/{id}` | Delete an event | — | `{deleted: true}` |
| POST | `/api/v1/schedules/import-caldav` | Import events from a CalDAV URL | `{caldav_url, username, password}` | `{imported_count: int}` |
| GET | `/api/v1/schedules/member/{member_id}` | Events for a specific member (Phase 10) | — | `{events: ScheduleEvent[], free_blocks: [...]}` |

#### Meals

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/v1/meals/plan?week=current` | Current week's meal plan | — | `{meals: MealPlan[], total_cost: float, avg_health_score: float}` |
| GET | `/api/v1/meals/plan?date=YYYY-MM-DD` | Meals for a specific date | — | `MealPlan[]` |
| POST | `/api/v1/meals/plan` | Create or update a meal plan entry | `MealPlan` (without id) | Created `MealPlan` |
| PUT | `/api/v1/meals/plan/{id}` | Update an existing meal plan | Partial `MealPlan` | Updated `MealPlan` |
| DELETE | `/api/v1/meals/plan/{id}` | Delete a meal plan entry | — | `{deleted: true}` |
| GET | `/api/v1/meals/grocery-list?week=current` | Consolidated grocery list from all meal plans for the week | — | `{items: [{ingredient, quantity_needed, est_cost}], total_est_cost: float}` |

#### Budgets

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/v1/budgets/summary?month=current` | Budget vs. actual by category for a month | — | `{categories: [{category, limit, spent, remaining, pct_used}], total_limit, total_spent}` |
| GET | `/api/v1/budgets/summary?month=YYYY-MM` | Budget summary for a specific month | — | Same as above |
| POST | `/api/v1/budgets` | Create or update a budget line | `Budget` (without id) | Created/updated `Budget` |
| GET | `/api/v1/budgets/transactions?month=current&category=groceries` | Filtered transaction list | — | `Transaction[]` |
| POST | `/api/v1/budgets/transactions` | Log a single transaction | `Transaction` (without id) | Created `Transaction` |
| POST | `/api/v1/budgets/import-csv` | Bulk import transactions from bank CSV | `multipart/form-data` with CSV file | `{imported_count: int, skipped: int, errors: string[]}` |
| GET | `/api/v1/budgets/forecast?months=3` | Simple spending forecast based on trends | — | `{months: [{month, projected_spend, projected_remaining}]}` |

#### Scoring

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/v1/scoring/log-activity` | Log a scored activity (server calculates points) | `{activity_type, duration_min, participants_count, details?}` | Created `Activity` with `points_earned` and `multipliers_applied` calculated |
| GET | `/api/v1/scoring/today` | Today's activities and total points | — | `{activities: Activity[], total_points: int}` |
| GET | `/api/v1/scoring/trends?weeks=4` | Weekly presence score trends | — | `{weeks: [{week_start, total_points, activity_count, top_activity_type}]}` |
| GET | `/api/v1/scoring/streaks` | Current active streaks | — | `{streaks: [{activity_type, consecutive_days, points_bonus}]}` |

#### Presence

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/v1/presence/start` | Start an unplugged session (pushes event to all WebSocket clients) | `{planned_duration_min, suggested_activity?}` | Created `PresenceSession` |
| POST | `/api/v1/presence/end` | End current unplugged session, auto-logs the scored activity | — | Completed `PresenceSession` + auto-created `Activity` |
| GET | `/api/v1/presence/current` | Get active unplugged session (if any) | — | `PresenceSession | null` |
| GET | `/api/v1/presence/stats?weeks=4` | Unplugged session statistics | — | `{total_sessions, total_hours, avg_duration_min, completion_rate_pct}` |

#### Configuration

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/v1/config/household` | Get household configuration | — | `HouseholdConfig` |
| PUT | `/api/v1/config/household` | Update household configuration | Partial `HouseholdConfig` | Updated `HouseholdConfig` |
| GET | `/api/v1/config/schema` | Export all Pydantic model JSON Schemas (for skill generation and schema-driven forms) | — | `{models: {ModelName: JSONSchema, ...}}` |
| GET | `/api/v1/health` | Health check endpoint | — | `{status: "ok", version: "1.0.0", uptime_seconds: int}` |

#### Members (Phase 10 — NEW)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/v1/members` | List all household members | — | `Member[]` |
| POST | `/api/v1/members` | Create a new member | `Member` (without id) | Created `Member` |
| PUT | `/api/v1/members/{id}` | Update a member | Partial `Member` | Updated `Member` |
| DELETE | `/api/v1/members/{id}` | Remove a member | — | `{deleted: true}` |
| GET | `/api/v1/members/{id}/score?period=week` | Get a member's total score for a period | — | `{member_id, total_points, breakdown: {activities, goals, chores}}` |

#### Personal Goals (Phase 10 — NEW)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/v1/goals?member_id=X` | List goals for a member | — | `PersonalGoal[]` |
| POST | `/api/v1/goals` | Create a new personal goal | `PersonalGoal` (without id) | Created `PersonalGoal` |
| PUT | `/api/v1/goals/{id}` | Update a goal | Partial `PersonalGoal` | Updated `PersonalGoal` |
| DELETE | `/api/v1/goals/{id}` | Deactivate a goal | — | `{deleted: true}` |
| POST | `/api/v1/goals/complete` | Log a goal completion | `{goal_id, member_id, duration_min?, notes?}` | Created `GoalCompletion` with `points_earned` |
| GET | `/api/v1/goals/progress?member_id=X&days=7` | Goal completion history and streaks | — | `{goals: [{goal, completions[], streak_days, points_total}]}` |

#### Chores (Phase 10 — NEW)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/v1/chores` | List all household chores | — | `Chore[]` |
| POST | `/api/v1/chores` | Create a new chore (parents only) | `Chore` (without id) | Created `Chore` |
| PUT | `/api/v1/chores/{id}` | Update a chore | Partial `Chore` | Updated `Chore` |
| DELETE | `/api/v1/chores/{id}` | Deactivate a chore | — | `{deleted: true}` |
| POST | `/api/v1/chores/complete` | Log a chore completion | `{chore_id, member_id}` | Created `ChoreCompletion` with `points_earned` |
| POST | `/api/v1/chores/verify/{completion_id}` | Parent verifies a chore completion | `{verified_by: member_id}` | Updated `ChoreCompletion` |
| GET | `/api/v1/chores/status?date=today` | Today's chore status per member | — | `{members: [{member_id, chores: [{chore, completed}]}]}` |

#### Google Calendar (Phase 10 — NEW)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/v1/google-calendar/auth-url` | Get OAuth2 authorization URL | — | `{url: string}` |
| POST | `/api/v1/google-calendar/callback` | Handle OAuth2 callback | `{code: string}` | `{success: true, member_id}` |
| POST | `/api/v1/google-calendar/sync/{member_id}` | Trigger sync for a member | — | `{imported: int, exported: int, updated: int}` |
| DELETE | `/api/v1/google-calendar/disconnect/{member_id}` | Disconnect Google Calendar | — | `{disconnected: true}` |

#### CSV Column Mappings (Phase 10 — NEW)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/v1/budgets/csv-mappings` | List saved CSV column mappings | — | `CsvColumnMapping[]` |
| POST | `/api/v1/budgets/csv-mappings` | Save a new column mapping profile | `CsvColumnMapping` (without id) | Created `CsvColumnMapping` |
| POST | `/api/v1/budgets/import-csv` | Import CSV with column mapping | `multipart/form-data` + `mapping_id` or inline `column_map` | `{imported_count, skipped, errors[]}` |
| POST | `/api/v1/budgets/import-csv/preview` | Preview first 5 rows with mapping applied | `multipart/form-data` + `column_map` | `{rows: Transaction[], warnings[]}` |

#### Travel Time (Phase 10 — NEW)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/v1/schedules/travel-time?from=X&to=Y` | Calculate travel time between locations | — | `{duration_min, distance_km, mode: "driving"}` |
| POST | `/api/v1/schedules/events/{id}/auto-travel` | Auto-calculate and set travel time for an event | `{from_location: string}` | Updated `ScheduleEvent` with `travel_time_min` |

### 5.3 WebSocket Events

The WebSocket endpoint at `/ws` pushes typed JSON events to all connected dashboard clients whenever data changes:

```json
{"event": "schedule_updated", "data": { ...ScheduleEvent }}
{"event": "meal_plan_changed", "data": { ...MealPlan }}
{"event": "transaction_logged", "data": { ...Transaction }}
{"event": "activity_scored", "data": { ...Activity }}
{"event": "presence_started", "data": { ...PresenceSession }}
{"event": "presence_ended", "data": { ...PresenceSession }}
{"event": "config_updated", "data": { ...HouseholdConfig }}
{"event": "goal_completed", "data": { ...GoalCompletion }}
{"event": "chore_completed", "data": { ...ChoreCompletion }}
{"event": "chore_verified", "data": { ...ChoreCompletion }}
{"event": "calendar_synced", "data": { member_id, imported, exported }}
```

The React frontend uses a `useWebSocket` hook that listens for these events and updates relevant component state in real-time.

---

## 6. Scoring System — "Become Who You Want to Be"

> **Phase 10 overhaul:** The scoring system has been redesigned from a household-only presence score to an **individual point system** that rewards personal growth, family connection, and household responsibility. Every family member earns their own points.

### 6.1 Three Point Sources

Every member earns individual points from three sources:

#### A. Family Activities (carried forward from MVP)

When a family activity is logged, **every participant earns individual points**.

| Activity Type | Base Points | Multiplier | Condition | Max/Day per person |
|--------------|-------------|------------|-----------|---------|
| `screen_free_family` | 10 pts/hr | x1.5 if 2+ participants | Manually logged or via OpenClaw | 60 pts |
| `outdoor` | 15 pts/hr | x2.0 if family activity | Logged by user or agent | 90 pts |
| `shared_meal` | 8 pts/meal | x1.3 if home-cooked (linked to meal plan) | Linked to meal_plans table | 32 pts |
| `game_creative` | 12 pts/hr | x1.5 streak bonus (3+ consecutive days) | Logged by user or agent | 54 pts |
| `one_on_one` | 20 pts/hr | x2.0 if activity was pre-scheduled (in a protected block) | Protected block used | 80 pts |

#### B. Personal Goals

Each member defines custom goals that reflect who they want to become. Points are configurable per goal.

**Examples:**
- Kid: "Practice piano 20 min" → 15 pts, daily
- Kid: "Read a book chapter" → 10 pts, daily
- Parent: "Morning run" → 20 pts, weekdays
- Parent: "Meditate 10 min" → 10 pts, daily

Goals have categories (`learning`, `fitness`, `creativity`, `mindfulness`, `health`, `other`) for dashboard grouping. Streak multipliers apply: x1.5 bonus after 3+ consecutive days of completing a goal.

#### C. Chores

Parents configure household chores with custom point values and assign them to specific members (or leave open for anyone).

**Examples:**
- "Make bed" → 5 pts (assigned to kids, daily)
- "Wash dishes" → 10 pts (assigned to everyone, daily)
- "Mow lawn" → 25 pts (assigned to teens, weekly)
- "Cook dinner" → 15 pts (assigned to parents, daily)

Optional: parents can verify chore completion before points are awarded.

### 6.2 Calculation Logic (Server-Side)

**For family activities** (`POST /api/v1/scoring/log-activity`):
1. Look up the base points for the `activity_type`.
2. Calculate `base_points = base_pts_per_hour * (duration_min / 60)`.
3. Check multiplier conditions (participants count, streak status, protected block linkage, meal plan linkage).
4. Apply the highest applicable multiplier (multipliers do NOT stack).
5. Cap at the daily max for that activity type.
6. Award points **individually to each participant** by `member_id`.

**For personal goals** (`POST /api/v1/goals/complete`):
1. Look up the goal's `points_per_completion`.
2. Check streak: if goal completed 3+ consecutive days, apply x1.5 multiplier.
3. Store a `GoalCompletion` record with points.

**For chores** (`POST /api/v1/chores/complete`):
1. Look up the chore's configured `points`.
2. Store a `ChoreCompletion` record.
3. Optionally await parent verification before crediting points.

### 6.3 Anti-Addiction Design Rules

- Scores are displayed as **weekly summaries**, with a simple daily progress indicator.
- There is **no competitive leaderboard**. Each member sees their own progress toward their own goals.
- The system **celebrates what went right** rather than shaming what didn't.
- The weekly reflection narrative (written by OpenClaw via the API) should be warm, encouraging, and personalized per member.
- Parents can see all family members' progress. Kids see only their own.

---

## 7. OpenClaw Integration

### 7.1 Overview

OpenClaw is an open-source autonomous AI agent that runs locally, connects to an external LLM, and interfaces with users via messaging platforms. Unplugged is built as a custom **OpenClaw AgentSkill** — a configuration file that describes what tools are available and how to call them.

### 7.2 Skill Definition

The OpenClaw skill is a JSON file in `openclaw-skill/skill.json` that maps Unplugged API endpoints to callable tools. Example structure:

```json
{
  "name": "unplugged",
  "description": "Household logistics management: schedules, meal planning, budgets, presence scoring, and screen-free time optimization.",
  "version": "1.0.0",
  "base_url": "http://unplugged.local/api/v1",
  "auth": {
    "type": "bearer",
    "token_env": "UNPLUGGED_API_KEY"
  },
  "tools": [
    {
      "name": "get_todays_schedule",
      "description": "Get all events and free time blocks for today. Returns events array and free_blocks array with start/end times and duration.",
      "method": "GET",
      "endpoint": "/schedules/today",
      "parameters": {}
    },
    {
      "name": "get_free_blocks",
      "description": "Find overlapping free time windows across household members for the next N days. Use this to find opportunities for family time.",
      "method": "GET",
      "endpoint": "/schedules/free-blocks",
      "parameters": {
        "days": {"type": "integer", "default": 7, "description": "Number of days to look ahead"}
      }
    },
    {
      "name": "protect_time_block",
      "description": "Mark a calendar event or time block as protected screen-free family time.",
      "method": "PUT",
      "endpoint": "/schedules/events/{id}/protect",
      "parameters": {
        "id": {"type": "integer", "description": "Event ID to protect"},
        "is_protected": {"type": "boolean", "description": "True to protect, false to unprotect"}
      }
    },
    {
      "name": "create_meal_plan",
      "description": "Create a meal plan entry. Health score should be 1-10 based on nutritional value. Prep time should account for the household's schedule constraints.",
      "method": "POST",
      "endpoint": "/meals/plan",
      "parameters": {
        "date": {"type": "string", "format": "date", "description": "YYYY-MM-DD"},
        "meal_type": {"type": "string", "enum": ["breakfast", "lunch", "dinner", "snack"]},
        "recipe_name": {"type": "string"},
        "ingredients": {"type": "array", "items": {"type": "string"}},
        "est_cost": {"type": "number", "description": "Estimated cost in USD"},
        "health_score": {"type": "integer", "minimum": 1, "maximum": 10},
        "prep_time_min": {"type": "integer"}
      }
    },
    {
      "name": "get_grocery_list",
      "description": "Get consolidated grocery list from all meal plans for the current week.",
      "method": "GET",
      "endpoint": "/meals/grocery-list",
      "parameters": {
        "week": {"type": "string", "default": "current"}
      }
    },
    {
      "name": "get_budget_summary",
      "description": "Get budget vs. actual spending by category. Use this to check remaining budget before suggesting purchases or meals.",
      "method": "GET",
      "endpoint": "/budgets/summary",
      "parameters": {
        "month": {"type": "string", "default": "current", "description": "YYYY-MM or 'current'"}
      }
    },
    {
      "name": "log_transaction",
      "description": "Log a financial transaction (expense or income).",
      "method": "POST",
      "endpoint": "/budgets/transactions",
      "parameters": {
        "date": {"type": "string", "format": "date"},
        "amount": {"type": "number", "description": "Negative for expenses, positive for income"},
        "description": {"type": "string"},
        "category": {"type": "string", "enum": ["groceries", "dining", "transport", "utilities", "entertainment", "health", "housing", "other"]}
      }
    },
    {
      "name": "log_activity",
      "description": "Log a presence-scored activity. Points are calculated server-side. Use this after the family has done something together.",
      "method": "POST",
      "endpoint": "/scoring/log-activity",
      "parameters": {
        "activity_type": {"type": "string", "enum": ["screen_free_family", "outdoor", "shared_meal", "game_creative", "one_on_one", "other"]},
        "duration_min": {"type": "integer", "description": "Duration in minutes"},
        "participants_count": {"type": "integer", "minimum": 1},
        "details": {"type": "object", "description": "Optional freeform details"}
      }
    },
    {
      "name": "get_score_trends",
      "description": "Get weekly presence score trends. Use this for weekly reflections and encouragement.",
      "method": "GET",
      "endpoint": "/scoring/trends",
      "parameters": {
        "weeks": {"type": "integer", "default": 4}
      }
    },
    {
      "name": "start_unplugged_session",
      "description": "Start a screen-free unplugged session for the household. This pushes a full-screen countdown to all connected dashboard clients.",
      "method": "POST",
      "endpoint": "/presence/start",
      "parameters": {
        "planned_duration_min": {"type": "integer", "description": "Intended duration in minutes"},
        "suggested_activity": {"type": "string", "description": "Activity to suggest on the unplugged screen"}
      }
    },
    {
      "name": "end_unplugged_session",
      "description": "End the current unplugged session. Automatically logs a scored activity based on the session duration.",
      "method": "POST",
      "endpoint": "/presence/end",
      "parameters": {}
    },
    {
      "name": "get_household_config",
      "description": "Get household preferences, health goals, dietary restrictions, and member list. Use this for context when making suggestions.",
      "method": "GET",
      "endpoint": "/config/household",
      "parameters": {}
    },
    {
      "name": "update_weekly_narrative",
      "description": "Write the weekly reflection narrative that appears on the dashboard. Should be warm, encouraging, and highlight positive trends.",
      "method": "PUT",
      "endpoint": "/config/household",
      "parameters": {
        "weekly_reflection_narrative": {"type": "string", "description": "Warm, encouraging weekly summary"}
      }
    }
  ]
}
```

### 7.3 Example Interaction Flow

1. Family member messages OpenClaw via Signal: *"What should we have for dinner tonight? Something quick, we have chicken."*
2. OpenClaw's LLM calls `get_todays_schedule` → learns the family has 45 min before evening activities.
3. Calls `get_budget_summary` (food category) → learns $85 remaining this week.
4. Calls `get_household_config` → learns one member is dairy-free.
5. LLM generates a 30-minute chicken stir-fry recipe (dairy-free, $12 estimated).
6. Calls `create_meal_plan` to write the plan to Unplugged's database.
7. Unplugged pushes `meal_plan_changed` event via WebSocket → kitchen tablet dashboard updates instantly.
8. OpenClaw replies in Signal: *"Tonight: Chicken stir-fry with vegetables (30 min prep, ~$12). Recipe is on the dashboard. You have family time blocked from 7–9pm — great night for that new puzzle!"*

---

## 8. Frontend Specification

### 8.1 Technology

- **React 18** with functional components and hooks
- **Vite** for build tooling (fast, works well on ARM64)
- **TailwindCSS** for styling (utility-first, consistent design system)
- **PWA** (Progressive Web App) — installable from browser, no app store
- **react-jsonschema-form** for schema-driven manual data entry forms

### 8.2 Screen Hierarchy

#### Home Dashboard (default view)

A single-screen summary designed to be **glanceable in under 10 seconds**. Layout:

- **Top row:** Date, household name, current presence score (weekly).
- **Schedule card:** Today's events as a compact timeline. Protected blocks are visually distinct (e.g., green glow). Free blocks are highlighted.
- **Meal card:** Today's planned meals with recipe name, prep time, health score badge.
- **Budget card:** Donut/bar chart showing budget utilization by category for the current month. Remaining total prominently displayed.
- **Score card:** Weekly presence points as a simple gauge or trend sparkline.
- **Unplugged button:** Large, prominent button to manually start an unplugged session.

#### Unplugged Mode (full-screen overlay)

When a presence session is active (triggered via API or manual button):

- Full-screen takeover with a **countdown timer** (large, centered).
- **Suggested activity** displayed below the timer.
- Calming, beautiful design — soft gradients, gentle animations. This is the one screen designed to stay visible.
- Minimal interaction — only an "End Session" button.

#### Module Views (tappable from dashboard cards)

- **Schedule View:** Full weekly calendar. Manual event creation form (schema-driven). Protected block toggle per event.
- **Meals View:** Weekly meal plan grid. Manual meal plan creation form. Grocery list view.
- **Budget View:** Category breakdown table. Transaction list with filters. CSV import interface. Budget limit editing.
- **Scoring View:** Activity log with points. Trend chart (weeks). Streak indicators.

#### Weekly Reflection (accessible from score card)

- Displays the `weekly_reflection_narrative` from HouseholdConfig (written by OpenClaw).
- Shows week-over-week comparison of key metrics: total presence points, hours unplugged, meals cooked, budget adherence.

### 8.3 Real-Time Updates

The frontend maintains a WebSocket connection to `/ws`. A custom `useWebSocket` hook:

1. Connects on mount, reconnects on disconnect with exponential backoff.
2. Listens for typed events (`schedule_updated`, `meal_plan_changed`, `presence_started`, etc.).
3. Updates the relevant React state/context, triggering re-renders.
4. When `presence_started` is received, automatically switches to Unplugged Mode full-screen.

### 8.4 Schema-Driven Forms

For manual data entry, the frontend fetches JSON Schemas from `GET /api/v1/config/schema` and renders forms using `react-jsonschema-form`. This means:

- Adding a field to a Pydantic model automatically updates the form — no frontend code change.
- Validation rules (min, max, required, enum) are enforced identically in the form and the API.

### 8.5 Visual Design Guidelines

- **Color palette:** Warm, nature-inspired. Soft greens (health), warm ambers (energy), calming blues (presence). No harsh productivity-app red/green.
- **Typography:** Inter (humanist sans-serif). Large sizing for tablet glanceability.
- **Dark mode default:** Evening is when families are together. Reduce blue light. Align with health mission.
- **Animations:** Subtle and purposeful. Presence score pulses gently during unplugged sessions. Cards slide in when updated via WebSocket.
- **Spacing:** Generous whitespace. Rounded corners. Soft shadows. Calm, not busy.

---

## 9. Deployment

### 9.1 Hardware Target

| Component | Specification |
|-----------|--------------|
| Board | Raspberry Pi 4 Model B, 8GB RAM |
| Storage | 32GB+ microSD (A2 rated) or USB 3.0 SSD |
| OS | Raspberry Pi OS 64-bit (Bookworm) |
| Network | Ethernet recommended; WiFi supported |
| Power | USB-C 5V/3A power supply |

### 9.2 Docker Compose

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
    restart: unless-stopped

  api:
    build: ./backend
    environment:
      - DATABASE_URL=sqlite:///data/unplugged.db
      - API_KEY=${UNPLUGGED_API_KEY}
      - HOUSEHOLD_ID=${HOUSEHOLD_ID:-default}
    volumes:
      - db_data:/app/data
    expose:
      - "8000"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  db_data:
```

### 9.3 Nginx Configuration

```nginx
server {
    listen 80;
    server_name unplugged.local;

    # Serve React static build
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to FastAPI
    location /api/ {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://api:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 9.4 OpenClaw Connection

- **Same Pi:** OpenClaw reaches API at `http://localhost/api/v1`
- **Same network:** `http://unplugged.local/api/v1`
- **Remote:** Cloudflare Tunnel provides HTTPS without port forwarding.
- **Auth:** API key set in both Unplugged's `.env` and OpenClaw's skill config.

### 9.5 Backups

A daily cron job (or APScheduler task) copies the SQLite database file to a mounted USB drive and/or cloud storage via `rclone`. SQLite is a single file, so backup is a simple `cp` with WAL checkpoint.

---

## 10. Project Structure

```
unplugged/
├── docker-compose.yml            # Pi deployment (production)
├── docker-compose.dev.yml        # Local development overrides
├── docker-compose.cloud.yml      # Cloud deployment overrides
├── .env.example                  # UNPLUGGED_API_KEY, DATABASE_URL, HOUSEHOLD_ID
│
├── frontend/                     # React PWA
│   ├── public/
│   │   ├── manifest.json         # PWA manifest
│   │   └── sw.js                 # Service worker for offline support
│   ├── src/
│   │   ├── App.jsx               # Root component with routing
│   │   ├── components/           # Reusable UI components
│   │   │   ├── Dashboard.jsx     # Home dashboard layout
│   │   │   ├── ScheduleCard.jsx  # Schedule summary card
│   │   │   ├── MealCard.jsx      # Meal plan summary card
│   │   │   ├── BudgetCard.jsx    # Budget summary card
│   │   │   ├── ScoreCard.jsx     # Presence score card
│   │   │   └── UnpluggedMode.jsx # Full-screen unplugged overlay
│   │   ├── views/                # Full-page views
│   │   │   ├── ScheduleView.jsx  # Full schedule management
│   │   │   ├── MealsView.jsx     # Meal planning interface
│   │   │   ├── BudgetView.jsx    # Budget & transaction management
│   │   │   ├── ScoringView.jsx   # Activity log & trends
│   │   │   └── ReflectionView.jsx# Weekly reflection
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js   # WebSocket connection with reconnect
│   │   │   ├── useApi.js         # API client wrapper
│   │   │   └── useSchema.js      # JSON Schema fetching for forms
│   │   ├── context/
│   │   │   └── HouseholdContext.jsx # Global household state
│   │   └── styles/
│   │       └── tailwind.css      # Tailwind base + custom tokens
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── Dockerfile
│
├── backend/                      # FastAPI application
│   ├── main.py                   # FastAPI app initialization, middleware, CORS
│   ├── database.py               # SQLModel engine setup, session management
│   ├── auth.py                   # API key validation middleware
│   ├── websocket.py              # WebSocket manager (connection tracking, broadcast)
│   ├── models/                   # Pydantic/SQLModel definitions (ONE FILE PER MODEL)
│   │   ├── schedule.py           # ScheduleEvent model
│   │   ├── meal.py               # MealPlan model
│   │   ├── transaction.py        # Transaction model
│   │   ├── budget.py             # Budget model
│   │   ├── activity.py           # Activity model
│   │   ├── presence.py           # PresenceSession model
│   │   └── config.py             # HouseholdConfig model
│   ├── api/                      # Route handlers (ONE FILE PER MODULE)
│   │   ├── schedules.py          # /api/v1/schedules/* routes
│   │   ├── meals.py              # /api/v1/meals/* routes
│   │   ├── budgets.py            # /api/v1/budgets/* routes
│   │   ├── scoring.py            # /api/v1/scoring/* routes
│   │   ├── presence.py           # /api/v1/presence/* routes
│   │   └── config.py             # /api/v1/config/* routes
│   ├── services/                 # Business logic (ONE FILE PER CONCERN)
│   │   ├── scoring_engine.py     # Points calculation, multipliers, daily caps
│   │   ├── free_block_finder.py  # Free block detection algorithm
│   │   ├── grocery_aggregator.py # Consolidate meal ingredients into grocery list
│   │   ├── budget_forecaster.py  # Simple linear spending projection
│   │   └── csv_importer.py       # Bank CSV parsing and transaction creation
│   ├── schemas/                  # JSON Schema export utilities
│   │   └── exporter.py           # Generates JSON Schema from all models
│   ├── requirements.txt
│   └── Dockerfile
│
├── nginx/
│   └── nginx.conf                # Reverse proxy configuration
│
├── openclaw-skill/               # OpenClaw AgentSkill package
│   ├── skill.json                # Tool definitions (as specified in Section 7.2)
│   └── README.md                 # Installation and configuration instructions
│
├── scripts/
│   ├── setup.sh                  # First-time Pi setup (Docker install, etc.)
│   ├── backup.sh                 # SQLite backup to USB/cloud
│   └── seed.py                   # Optional: seed database with sample data
│
└── docs/
    ├── PRD.md                    # This document
    └── API.md                    # Auto-generated from FastAPI OpenAPI spec
```

---

## 11. Migration Path (Pi → Cloud)

| Phase | Action | Complexity | Timeline |
|-------|--------|-----------|----------|
| 2a | Swap SQLite → PostgreSQL (change `DATABASE_URL` in `.env`) | Low — one config change | 1 day |
| 2b | Add multi-tenant auth (JWT + household isolation middleware) | Medium — new auth layer | 2–4 weeks |
| 2c | Deploy to cloud VPS or Kubernetes (same Docker Compose) | Medium — infra setup | 1–2 weeks |
| 2d | Add Plaid integration for automatic bank transaction sync | High — compliance | 4–6 weeks |
| 2e | Publish skill to OpenClaw's ClawHub registry | Low — packaging | 1 week |
| 2f | Multi-household SaaS with billing and onboarding | High — full product | 8–12 weeks |

The migration is simple because Unplugged is just a web app with a database. No LLM infra to migrate, no model serving to scale. OpenClaw handles its own scaling independently.

---

## 12. Development Priorities

### MVP (Weeks 1–6)

Build in this order:

1. **Backend scaffolding:** FastAPI app, SQLModel database setup, Pydantic models for all 7 entities, health check endpoint.
2. **Schedule module:** Full CRUD API + free block detection algorithm.
3. **Meal module:** Full CRUD API + grocery list aggregation.
4. **Budget module:** Full CRUD API + CSV import + monthly summary.
5. **Scoring module:** Activity logging API + server-side points calculation.
6. **Presence module:** Start/end session API + auto-score on end.
7. **WebSocket manager:** Broadcast typed events on any data mutation.
8. **Config module:** Household config CRUD + JSON Schema export endpoint.
9. **React dashboard:** Home screen with all 5 cards + unplugged mode overlay.
10. **Docker deployment:** `docker compose up` working on Pi 4B.
11. **OpenClaw skill:** `skill.json` covering all endpoints + README.

### Phase 10: Individual Scoring, Google Calendar, Locations & CSV Mapping

Build in this order:

1. **Member profiles:** `Member` model + CRUD API. Migrate existing `participants` string lists to member ID references.
2. **Personal goals:** `PersonalGoal` + `GoalCompletion` models + API. Per-member goal tracking with streak detection.
3. **Chore system:** `Chore` + `ChoreCompletion` models + API. Parent-configurable chores with point values and optional verification.
4. **Scoring engine overhaul:** Refactor `scoring_engine.py` to award individual points per participant. Merge family activities, goals, and chores into unified per-member score.
5. **Schedule locations + travel time:** Add `location`, `travel_time_min`, `assigned_member_ids` fields to `ScheduleEvent`. Google Maps Directions API integration for auto-calculated travel time.
6. **Google Calendar two-way sync:** OAuth2 flow, `google_event_id` tracking, sync service that imports/exports events per member.
7. **CSV column mapping:** `CsvColumnMapping` model + saved profiles. Preview endpoint. Support for credit card and checking statement formats with configurable amount sign inversion.
8. **Frontend updates:** Per-member dashboard views, goal tracker UI, chore board, member calendar filters, CSV import wizard with column mapping.
9. **OpenClaw skill update:** Add new tools for goals, chores, member scores, and calendar sync.

### V1.0 (Post Phase 10)

- Schema-driven forms for all manual data entry
- Weekly reflection view (renders OpenClaw-written narrative, personalized per member)
- API key auth and rate limiting
- Automated daily SQLite backup
- PWA offline support for core read-only views

### V2.0 — Cloud Launch (Future)

- Multi-tenant PostgreSQL deployment
- JWT authentication
- Plaid integration
- ClawHub skill publication
- Onboarding API
- Public landing page and billing

---

*Built with intention. Designed for connection. Powered by the claw. 🦞*
