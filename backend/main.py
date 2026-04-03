import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from database import create_db_and_tables, get_session, migrate_chore_schedule_columns
from websocket import manager

logger = logging.getLogger("unplugged.autosync")

# Import all models so SQLModel registers them
import models  # noqa: F401

# Import API routers
from api.schedules import router as schedules_router
from api.meals import router as meals_router
from api.budgets import router as budgets_router
from api.scoring import router as scoring_router
from api.presence import router as presence_router
from api.config import router as config_router
from api.members import router as members_router
from api.goals import router as goals_router
from api.chores import router as chores_router
from api.google_calendar import router as google_calendar_router
from api.ai_context import router as ai_context_router
from api.todos import router as todos_router

START_TIME = time.time()


async def _auto_sync_all():
    """Sync Google Calendar for all connected members."""
    from sqlmodel import select
    from models.member import Member
    from services.google_calendar import sync_member_calendar

    session = next(get_session())
    try:
        all_members = session.exec(select(Member)).all()
        members = [m for m in all_members if m.google_credentials]
        if not members:
            return

        for member in members:
            try:
                result = sync_member_calendar(member, session)
                logger.info(
                    "Auto-sync %s: imported=%d exported=%d updated=%d",
                    member.name, result["imported"], result["exported"], result["updated"],
                )
                await manager.broadcast("calendar_synced", {
                    "member_id": member.id,
                    **result,
                })
            except Exception:
                logger.exception("Auto-sync failed for member %s", member.name)
    finally:
        session.close()


scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    migrate_chore_schedule_columns()
    scheduler.add_job(_auto_sync_all, "interval", minutes=60, id="google_calendar_sync")
    scheduler.start()
    logger.info("Google Calendar auto-sync scheduled (every 60 minutes)")
    yield
    scheduler.shutdown(wait=False)


tags_metadata = [
    {"name": "AI Context", "description": "Consolidated endpoints designed for AI agents to get full household state in a single call."},
    {"name": "Schedules", "description": "Manage calendar events, free time blocks, and travel time calculations."},
    {"name": "Meals", "description": "Meal planning, recipe management, and grocery list generation."},
    {"name": "Budgets", "description": "Budget tracking, transaction logging, CSV import, and spending forecasts."},
    {"name": "Scoring", "description": "Presence scoring system — log family activities and track points."},
    {"name": "Presence", "description": "Screen-free unplugged sessions with countdown timer and auto-scoring."},
    {"name": "Configuration", "description": "Household config, member preferences, and JSON Schema export."},
    {"name": "Members", "description": "Family member profiles, roles, and per-member score breakdowns."},
    {"name": "Goals", "description": "Personal goals with streak tracking and point rewards."},
    {"name": "Chores", "description": "Household chore management with completion tracking and parent verification."},
    {"name": "Google Calendar", "description": "OAuth2-based two-way Google Calendar sync."},
    {"name": "To-Dos", "description": "One-off to-do items with priority, due dates, and member assignment."},
]

app = FastAPI(
    title="Unplugged",
    description=(
        "Household data platform for screen-free family time. "
        "This API serves two consumers: a React dashboard for humans "
        "and autonomous AI agents (like OpenClaw) that manage schedules, "
        "meals, budgets, and presence scoring.\n\n"
        "**AI Agents:** Start with `GET /api/v1/ai/context` for a full "
        "household snapshot. See `/llms.txt` for detailed instructions."
    ),
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=tags_metadata,
    contact={
        "name": "Unplugged",
        "url": "https://github.com/HairlessJHarrison/My_Ai_Mentor",
    },
    license_info={
        "name": "MIT",
    },
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(schedules_router)
app.include_router(meals_router)
app.include_router(budgets_router)
app.include_router(scoring_router)
app.include_router(presence_router)
app.include_router(config_router)
app.include_router(members_router)
app.include_router(goals_router)
app.include_router(chores_router)
app.include_router(google_calendar_router)
app.include_router(ai_context_router)
app.include_router(todos_router)


@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "ok",
        "version": "1.0.0",
        "uptime_seconds": int(time.time() - START_TIME),
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

