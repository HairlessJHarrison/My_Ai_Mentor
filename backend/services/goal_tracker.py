"""Goal tracker — streak detection and point calculation for personal goals."""

import datetime as dt

from sqlmodel import Session, select

from models.goal import PersonalGoal, GoalCompletion


def calculate_goal_points(
    goal: PersonalGoal,
    member_id: int,
    session: Session,
) -> int:
    """Calculate points for completing a goal, including streak multiplier.

    Streak bonus: x1.5 after 3+ consecutive days of completing the same goal.
    """
    base_points = goal.points_per_completion

    # Check streak for this specific goal
    streak_days = _get_goal_streak_days(session, goal.id, member_id)

    multiplier = 1.0
    if streak_days >= 2:  # Today would make it 3+
        multiplier = 1.5

    return int(round(base_points * multiplier))


def get_goal_progress(
    session: Session,
    member_id: int,
    household_id: str,
    days: int = 7,
) -> list[dict]:
    """Get goal completion history and streaks for a member."""
    today = dt.date.today()
    start_date = today - dt.timedelta(days=days - 1)

    goals = session.exec(
        select(PersonalGoal).where(
            PersonalGoal.household_id == household_id,
            PersonalGoal.member_id == member_id,
            PersonalGoal.is_active == True,
        )
    ).all()

    result = []
    for goal in goals:
        completions = session.exec(
            select(GoalCompletion).where(
                GoalCompletion.goal_id == goal.id,
                GoalCompletion.member_id == member_id,
                GoalCompletion.date >= start_date,
                GoalCompletion.date <= today,
            )
        ).all()

        streak_days = _get_goal_streak_days(session, goal.id, member_id)
        # Include today if completed today
        today_completed = any(c.date == today for c in completions)
        if today_completed:
            streak_days += 1

        points_total = sum(c.points_earned for c in completions)

        result.append({
            "goal": goal.model_dump(mode="json"),
            "completions": [c.model_dump(mode="json") for c in completions],
            "streak_days": streak_days,
            "points_total": points_total,
        })

    return result


def _get_goal_streak_days(session: Session, goal_id: int, member_id: int) -> int:
    """Count consecutive days with at least one completion, ending yesterday."""
    today = dt.date.today()
    streak = 0

    for offset in range(1, 366):
        check_date = today - dt.timedelta(days=offset)
        count = len(session.exec(
            select(GoalCompletion).where(
                GoalCompletion.goal_id == goal_id,
                GoalCompletion.member_id == member_id,
                GoalCompletion.date == check_date,
            )
        ).all())
        if count > 0:
            streak += 1
        else:
            break

    return streak
