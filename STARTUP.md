# Unplugged — Local Development Startup Guide

Follow these steps exactly to get the project running locally for development and testing.

## Prerequisites

- **Python 3.12+** with `pip`
- **Node.js 20+** with `npm`
- **Git** (to clone the repo)

## Project Structure

```
My_AI_Mentor/
├── backend/          # FastAPI (Python) API server
├── frontend/         # React + Vite + Tailwind frontend
├── .env.example      # Environment variable template
└── .env              # Local environment config (you create this)
```

## Step-by-Step Setup

### Step 1: Create the `.env` file

Copy the template and clear the API key so the backend runs in dev mode (no auth):

```bash
cp .env.example .env
```

Then edit `.env` so it looks exactly like this:

```
UNPLUGGED_API_KEY=
DATABASE_URL=sqlite:///data/unplugged.db
HOUSEHOLD_ID=default
```

**Important:** `UNPLUGGED_API_KEY=` must be empty (no value after `=`). When this is empty, the backend skips authentication, which is required because the frontend does not send auth headers. If you set a value here, every API call from the frontend will fail with "Invalid or missing API key".

### Step 2: Install backend dependencies

From the project root:

```bash
cd backend
pip install -r requirements.txt
```

### Step 3: Install frontend dependencies

From the project root:

```bash
cd frontend
npm install
```

### Step 4: Start the backend server

From the `backend/` directory:

```bash
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

This starts the FastAPI server on port 8000 with hot reload enabled. The SQLite database (`backend/data/unplugged.db`) is created automatically on first run.

**Leave this terminal running.**

### Step 5: Start the frontend dev server

In a **separate terminal**, from the `frontend/` directory:

```bash
cd frontend
npm run dev
```

This starts the Vite dev server on port 5173 with hot module replacement. The Vite config (`frontend/vite.config.js`) proxies all `/api` and `/ws` requests to `http://127.0.0.1:8000`, so the frontend and backend work together seamlessly.

**Leave this terminal running.**

### Step 6: Verify everything is working

1. **Backend health check:** Open http://localhost:8000/api/v1/health — should return:
   ```json
   {"status": "ok", "version": "1.0.0", "uptime_seconds": ...}
   ```

2. **API documentation:** Open http://localhost:8000/docs — interactive Swagger UI for all 63 API endpoints.

3. **Frontend app:** Open http://localhost:5173 — the React dashboard should load. On first visit, you will see the onboarding wizard.

## Ports Used

| Service          | Port | URL                          |
|------------------|------|------------------------------|
| Backend API      | 8000 | http://localhost:8000        |
| Frontend (Vite)  | 5173 | http://localhost:5173        |

## Stopping the Servers

Press `Ctrl+C` in each terminal to stop the backend and frontend servers.

## Restarting

After the initial setup, you only need Steps 4 and 5 to restart. Dependencies and `.env` persist.

## Running Tests

From the `backend/` directory:

```bash
pip install -r requirements-test.txt
PYTHONPATH=. pytest tests/ -v --tb=short
```

For coverage:

```bash
PYTHONPATH=. pytest tests/ -v --cov=. --cov-report=term-missing
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Invalid or missing API key" on any action | `UNPLUGGED_API_KEY` has a value in `.env` | Set it to empty: `UNPLUGGED_API_KEY=` and restart the backend |
| Frontend shows blank/error | Backend not running | Start the backend first (Step 4), then refresh the frontend |
| Port 8000 already in use | Another process on that port | Kill it or change the port in the uvicorn command and in `frontend/vite.config.js` |
| Port 5173 already in use | Another Vite instance | Kill it or Vite will auto-increment to 5174 |
| Google Calendar connect fails | Google OAuth credentials not configured | This is optional. Skip the calendar step in onboarding. To enable it, add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` to `.env` |

## Tech Stack Reference

- **Backend:** FastAPI 0.115, Uvicorn, SQLModel, SQLite, Python 3.12
- **Frontend:** React 19, Vite 7, Tailwind CSS 4, React Router 7
- **Database:** SQLite (auto-created at `backend/data/unplugged.db`)
