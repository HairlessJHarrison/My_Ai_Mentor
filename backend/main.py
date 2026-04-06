import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()

from database import create_db_and_tables, get_session, migrate_chore_schedule_columns, migrate_achievement_renewal_columns, migrate_kiosk_settings, migrate_meal_history_tables
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
from api.achievements import router as achievements_router
from api.dashboard import router as dashboard_router
from api.notifications import router as notifications_router
from api.backups import router as backups_router
from api.kiosk import router as kiosk_router
from api.shopping_lists import router as shopping_lists_router

START_TIME = time.time()

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


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


async def _check_daily_goal_reminders():
    """Check for uncompleted daily goals and fire in-app reminder notifications."""
    import datetime as dt
    from sqlmodel import select, or_
    from models.member import Member
    from models.goal import PersonalGoal, GoalCompletion
    from models.notification import Notification, ReminderConfig

    now = dt.datetime.now()
    today = dt.date.today()

    session = next(get_session())
    try:
        # Build a map of reminder configs keyed by member_id (None = global default)
        configs = session.exec(
            select(ReminderConfig).where(ReminderConfig.household_id == HOUSEHOLD_ID)
        ).all()
        config_map: dict[int | None, ReminderConfig] = {c.member_id: c for c in configs}
        global_cfg = config_map.get(None)

        members = session.exec(
            select(Member).where(Member.household_id == HOUSEHOLD_ID)
        ).all()

        for member in members:
            member_cfg = config_map.get(member.id, global_cfg)

            # Determine reminder time for this member
            if member_cfg:
                if not member_cfg.enabled:
                    continue
                r_hour = member_cfg.reminder_hour
                r_minute = member_cfg.reminder_minute
            else:
                r_hour, r_minute = 18, 0  # sensible default: 6 PM

            # Fire only within a 5-minute window of the configured time
            if now.hour != r_hour:
                continue
            if abs(now.minute - r_minute) >= 5:
                continue

            # Don't send a second reminder today
            day_start = dt.datetime.combine(today, dt.time.min)
            already_sent = session.exec(
                select(Notification).where(
                    Notification.household_id == HOUSEHOLD_ID,
                    Notification.member_id == member.id,
                    Notification.type == "goal_reminder",
                    Notification.created_at >= day_start,
                )
            ).first()
            if already_sent:
                continue

            # Find uncompleted active daily goals for this member
            daily_goals = session.exec(
                select(PersonalGoal).where(
                    PersonalGoal.household_id == HOUSEHOLD_ID,
                    PersonalGoal.member_id == member.id,
                    PersonalGoal.is_active == True,
                    PersonalGoal.target_frequency == "daily",
                )
            ).all()
            if not daily_goals:
                continue

            completed_ids = set(
                session.exec(
                    select(GoalCompletion.goal_id).where(
                        GoalCompletion.member_id == member.id,
                        GoalCompletion.date == today,
                    )
                ).all()
            )

            uncompleted = [g for g in daily_goals if g.id not in completed_ids]
            if not uncompleted:
                continue

            names = ", ".join(g.title for g in uncompleted[:3])
            if len(uncompleted) > 3:
                names += f" +{len(uncompleted) - 3} more"

            notif = Notification(
                household_id=HOUSEHOLD_ID,
                member_id=member.id,
                message=f"Don't forget your goals today: {names}",
                type="goal_reminder",
            )
            session.add(notif)
            session.commit()
            session.refresh(notif)
            await manager.broadcast("notification_created", notif.model_dump(mode="json"))
            logger.info("Goal reminder sent to member %s (%d uncompleted)", member.name, len(uncompleted))
    finally:
        session.close()


scheduler = AsyncIOScheduler()


def _daily_backup():
    """Create a daily database backup; called by APScheduler."""
    from services.backup import create_backup
    try:
        result = create_backup()
        logger.info("Daily backup created: %s (%d bytes)", result["filename"], result["size_bytes"])
    except Exception:
        logger.exception("Daily backup failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    migrate_chore_schedule_columns()
    migrate_achievement_renewal_columns()
    migrate_kiosk_settings()
    migrate_meal_history_tables()
    # Ensure photos directory exists for static file serving
    Path(os.getenv("PHOTOS_DIR", "data/photos")).mkdir(parents=True, exist_ok=True)
    scheduler.add_job(_auto_sync_all, "interval", minutes=60, id="google_calendar_sync")
    scheduler.add_job(_check_daily_goal_reminders, "interval", minutes=5, id="goal_reminders")
    scheduler.add_job(_daily_backup, "cron", hour=3, minute=0, id="daily_db_backup")
    scheduler.start()
    logger.info("Google Calendar auto-sync scheduled (every 60 minutes)")
    logger.info("Daily goal reminder check scheduled (every 5 minutes)")
    logger.info("Daily database backup scheduled (03:00 UTC)")
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
    {"name": "Achievements", "description": "Per-member achievement cups with prize goals earned through chores and goals."},
    {"name": "Notifications", "description": "In-app notifications and configurable daily goal reminder scheduling."},
    {"name": "Backups", "description": "Trigger manual database backups and list available snapshots."},
    {"name": "Kiosk", "description": "Kiosk display mode settings and screensaver photo library management."},
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

# Serve screensaver photos as static files — directory is created in lifespan
_photos_dir = Path(os.getenv("PHOTOS_DIR", "data/photos"))
_photos_dir.mkdir(parents=True, exist_ok=True)
app.mount("/photos", StaticFiles(directory=str(_photos_dir)), name="photos")

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
app.include_router(achievements_router)
app.include_router(dashboard_router)
app.include_router(notifications_router)
app.include_router(backups_router)
app.include_router(kiosk_router)
app.include_router(shopping_lists_router)


AVATAR_DIR = os.getenv("AVATAR_DIR", "data/avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)
app.mount("/api/v1/members/avatars", StaticFiles(directory=AVATAR_DIR), name="avatars")


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

