"""AI Context module — consolidated snapshot endpoint for AI agents."""

import datetime as dt
import os

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.config import HouseholdConfig
from models.member import Member
from models.schedule import ScheduleEvent
from models.meal import MealPlan
from models.budget import Budget
from models.transaction import Transaction
from models.activity import Activity
from models.presence import PresenceSession
from models.chore import Chore, ChoreCompletion
from services.free_block_finder import find_free_blocks

router = APIRouter(prefix="/api/v1/ai", tags=["AI Context"])

HOUSEHOLD_ID = os.getenv("HOUSEHOLD_ID", "default")


@router.get("/context")
async def get_ai_context(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """
    Consolidated household snapshot for AI agents.

    Returns the complete current state in a single call: household config,
    members, today's schedule and free blocks, today's meals, budget summary,
    today's score, active presence session, and pending chores.

    **This is the recommended first call for any AI agent.**
    """
    today = dt.date.today()

    # --- Household Config ---
    config = session.exec(
        select(HouseholdConfig).where(HouseholdConfig.household_id == HOUSEHOLD_ID)
    ).first()

    config_data = config.model_dump(mode="json") if config else {
        "household_id": HOUSEHOLD_ID,
        "household_name": "My Household",
        "members": [],
        "health_goals": [],
        "dietary_restrictions": [],
        "preferences": {},
        "weekly_reflection_narrative": None,
    }

    # --- Members ---
    members = session.exec(
        select(Member).where(Member.household_id == HOUSEHOLD_ID)
    ).all()

    # --- Today's Schedule ---
    events = session.exec(
        select(ScheduleEvent).where(ScheduleEvent.date == today)
    ).all()
    free_blocks = find_free_blocks(list(events), today)

    # --- Today's Meals ---
    meals = session.exec(
        select(MealPlan).where(MealPlan.date == today)
    ).all()

    # --- Budget Summary (current month) ---
    current_month = today.strftime("%Y-%m")
    budgets = session.exec(
        select(Budget).where(
            Budget.household_id == HOUSEHOLD_ID,
            Budget.month == current_month,
        )
    ).all()

    month_start = today.replace(day=1)
    if today.month == 12:
        month_end = today.replace(year=today.year + 1, month=1, day=1)
    else:
        month_end = today.replace(month=today.month + 1, day=1)

    transactions = session.exec(
        select(Transaction).where(
            Transaction.household_id == HOUSEHOLD_ID,
            Transaction.date >= month_start,
            Transaction.date < month_end,
        )
    ).all()

    budget_categories = []
    for b in budgets:
        spent = round(abs(sum(
            t.amount for t in transactions
            if t.amount < 0 and t.category == b.category
        )), 2)
        budget_categories.append({
            "category": b.category,
            "limit": b.limit_amount,
            "spent": spent,
            "remaining": round(b.limit_amount - spent, 2),
            "pct_used": round(spent / b.limit_amount * 100, 1) if b.limit_amount > 0 else 0,
        })

    total_limit = sum(b.limit_amount for b in budgets)
    total_spent = sum(c["spent"] for c in budget_categories)

    # --- Today's Score ---
    activities = session.exec(
        select(Activity).where(
            Activity.household_id == HOUSEHOLD_ID,
            Activity.date == today,
        )
    ).all()
    total_points = sum(a.points_earned for a in activities)

    # --- Active Presence Session ---
    active_session = session.exec(
        select(PresenceSession).where(
            PresenceSession.household_id == HOUSEHOLD_ID,
            PresenceSession.status == "active",
        )
    ).first()

    # --- Pending Chores (today) ---
    chores = session.exec(
        select(Chore).where(
            Chore.household_id == HOUSEHOLD_ID,
            Chore.is_active == True,  # noqa: E712
        )
    ).all()

    chore_completions_today = session.exec(
        select(ChoreCompletion).where(
            ChoreCompletion.household_id == HOUSEHOLD_ID,
            ChoreCompletion.date == today,
        )
    ).all()
    completed_chore_ids = {(cc.chore_id, cc.member_id) for cc in chore_completions_today}

    chore_status_by_member = {}
    for m in members:
        member_chores = []
        for c in chores:
            # Include if assigned to this member or unassigned (anyone)
            if not c.assigned_member_ids or m.id in (c.assigned_member_ids or []):
                member_chores.append({
                    "chore": c.model_dump(mode="json"),
                    "completed": (c.id, m.id) in completed_chore_ids,
                })
        if member_chores:
            chore_status_by_member[m.id] = {
                "member_id": m.id,
                "member_name": m.name,
                "chores": member_chores,
            }

    return {
        "household": config_data,
        "members": [m.model_dump(mode="json") for m in members],
        "today_schedule": {
            "events": [e.model_dump(mode="json") for e in events],
            "free_blocks": free_blocks,
        },
        "today_meals": [m.model_dump(mode="json") for m in meals],
        "budget_summary": {
            "month": current_month,
            "categories": budget_categories,
            "total_limit": round(total_limit, 2),
            "total_spent": round(total_spent, 2),
        },
        "today_score": {
            "activities": [a.model_dump(mode="json") for a in activities],
            "total_points": total_points,
        },
        "active_presence_session": active_session.model_dump(mode="json") if active_session else None,
        "pending_chores": {
            "members": list(chore_status_by_member.values()),
        },
    }
