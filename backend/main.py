import os
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from database import create_db_and_tables, migrate_chore_schedule_columns
from websocket import manager

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

START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    migrate_chore_schedule_columns()
    yield


app = FastAPI(
    title="Unplugged",
    description="Household data platform for screen-free family time",
    version="1.0.0",
    lifespan=lifespan,
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

