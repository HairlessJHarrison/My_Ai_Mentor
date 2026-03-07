"""Scoring engine — points calculation with multipliers, daily caps, and streak detection."""

import datetime as dt
from typing import Any

from sqlmodel import Session, select

from models.activity import Activity


# Scoring rules from the PRD
SCORING_RULES: dict[str, dict[str, Any]] = {
    "screen_free_family": {
        "base_pts_per_hour": 10,
        "multiplier": 1.5,
        "multiplier_condition": "2+ participants",
        "max_per_day": 60,
    },
    "outdoor": {
        "base_pts_per_hour": 15,
        "multiplier": 2.0,
        "multiplier_condition": "family activity (2+ participants)",
        "max_per_day": 90,
    },
    "shared_meal": {
        "base_pts_per_meal": 8,
        "multiplier": 1.3,
        "multiplier_condition": "home-cooked (linked to meal plan)",
        "max_per_day": 32,
    },
    "game_creative": {
        "base_pts_per_hour": 12,
        "multiplier": 1.5,
        "multiplier_condition": "3+ day streak",
        "max_per_day": 54,
    },
    "one_on_one": {
        "base_pts_per_hour": 20,
        "multiplier": 2.0,
        "multiplier_condition": "pre-scheduled in protected block",
        "max_per_day": 80,
    },
    "other": {
        "base_pts_per_hour": 5,
        "multiplier": 1.0,
        "multiplier_condition": "none",
        "max_per_day": 30,
    },
}


def calculate_points(
    activity_type: str,
    duration_min: int,
    participants_count: int,
    session: Session,
    household_id: str = "default",
    details: dict | None = None,
) -> tuple[int, list[str]]:
    """Calculate points for an activity.

    Returns: (points_earned, multipliers_applied)
    """
    rules = SCORING_RULES.get(activity_type, SCORING_RULES["other"])
    multipliers_applied: list[str] = []

    # Calculate base points
    if activity_type == "shared_meal":
        # Shared meals are per-meal, not per-hour
        base_points = rules["base_pts_per_meal"]
    else:
        base_points = rules["base_pts_per_hour"] * (duration_min / 60)

    # Check multiplier conditions
    multiplier = 1.0

    if activity_type in ("screen_free_family", "outdoor") and participants_count >= 2:
        multiplier = rules["multiplier"]
        multipliers_applied.append(rules["multiplier_condition"])

    elif activity_type == "shared_meal":
        # Check if there's a linked meal plan (simplified: check details)
        if details and details.get("home_cooked", False):
            multiplier = rules["multiplier"]
            multipliers_applied.append(rules["multiplier_condition"])

    elif activity_type == "game_creative":
        # Check for streak (3+ consecutive days)
        streak = _get_streak_days(session, household_id, activity_type)
        if streak >= 2:  # current day would make it 3+
            multiplier = rules["multiplier"]
            multipliers_applied.append(f"3+ day streak ({streak + 1} days)")

    elif activity_type == "one_on_one":
        # Check if pre-scheduled in protected block
        if details and details.get("protected_block", False):
            multiplier = rules["multiplier"]
            multipliers_applied.append(rules["multiplier_condition"])

    # Apply multiplier
    points = base_points * multiplier

    # Check daily cap
    today = dt.date.today()
    today_points = _get_today_points(session, household_id, activity_type, today)
    max_daily = rules["max_per_day"]

    remaining_cap = max(0, max_daily - today_points)
    points = min(points, remaining_cap)

    return int(round(points)), multipliers_applied


def get_streaks(session: Session, household_id: str = "default") -> list[dict]:
    """Get current active streaks for all activity types."""
    streaks: list[dict] = []

    for activity_type in SCORING_RULES:
        if activity_type == "other":
            continue
        days = _get_streak_days(session, household_id, activity_type)
        if days >= 2:
            # Bonus points for streaks
            bonus = days * 5  # 5 bonus points per day in streak
            streaks.append({
                "activity_type": activity_type,
                "consecutive_days": days,
                "points_bonus": bonus,
            })

    return streaks


def get_weekly_trends(
    session: Session,
    household_id: str = "default",
    weeks: int = 4,
) -> list[dict]:
    """Get weekly presence score trends."""
    trends: list[dict] = []
    today = dt.date.today()

    for w in range(weeks):
        week_end = today - dt.timedelta(days=today.weekday()) - dt.timedelta(weeks=w)
        week_start = week_end - dt.timedelta(days=6)
        if w == 0:
            week_start = today - dt.timedelta(days=today.weekday())
            week_end = today

        activities = session.exec(
            select(Activity).where(
                Activity.household_id == household_id,
                Activity.date >= week_start,
                Activity.date <= week_end,
            )
        ).all()

        total_points = sum(a.points_earned for a in activities)
        activity_count = len(activities)

        # Find top activity type
        type_counts: dict[str, int] = {}
        for a in activities:
            type_counts[a.activity_type] = type_counts.get(a.activity_type, 0) + 1
        top_type = max(type_counts, key=type_counts.get) if type_counts else None

        trends.append({
            "week_start": week_start.isoformat(),
            "total_points": total_points,
            "activity_count": activity_count,
            "top_activity_type": top_type,
        })

    return trends


def _get_streak_days(session: Session, household_id: str, activity_type: str) -> int:
    """Count consecutive days with at least one activity of the given type, ending yesterday."""
    today = dt.date.today()
    streak = 0

    for offset in range(1, 366):  # Look back up to a year
        check_date = today - dt.timedelta(days=offset)
        count = len(session.exec(
            select(Activity).where(
                Activity.household_id == household_id,
                Activity.activity_type == activity_type,
                Activity.date == check_date,
            )
        ).all())
        if count > 0:
            streak += 1
        else:
            break

    return streak


def _get_today_points(
    session: Session, household_id: str, activity_type: str, today: dt.date
) -> int:
    """Get total points already earned today for a specific activity type."""
    activities = session.exec(
        select(Activity).where(
            Activity.household_id == household_id,
            Activity.activity_type == activity_type,
            Activity.date == today,
        )
    ).all()
    return sum(a.points_earned for a in activities)
