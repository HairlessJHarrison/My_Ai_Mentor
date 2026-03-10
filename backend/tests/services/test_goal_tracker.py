"""Tests for goal_tracker — requires DB session."""

import datetime as dt

from tests.conftest import make_goal, make_goal_completion, make_member
from services.goal_tracker import calculate_goal_points, get_goal_progress


class TestCalculateGoalPoints:
    def test_base_points_no_streak(self, session):
        member = make_member(session)
        goal = make_goal(session, member_id=member.id, points_per_completion=10)
        points = calculate_goal_points(goal, member.id, session)
        assert points == 10

    def test_streak_multiplier_3_days(self, session):
        member = make_member(session)
        goal = make_goal(session, member_id=member.id, points_per_completion=10)
        today = dt.date.today()
        # Seed 2 consecutive days
        for i in range(1, 3):
            make_goal_completion(
                session,
                goal_id=goal.id,
                member_id=member.id,
                date=today - dt.timedelta(days=i),
            )
        points = calculate_goal_points(goal, member.id, session)
        assert points == 15  # 10 * 1.5

    def test_one_day_no_multiplier(self, session):
        member = make_member(session)
        goal = make_goal(session, member_id=member.id, points_per_completion=10)
        today = dt.date.today()
        make_goal_completion(
            session,
            goal_id=goal.id,
            member_id=member.id,
            date=today - dt.timedelta(days=1),
        )
        points = calculate_goal_points(goal, member.id, session)
        assert points == 10  # only 1 day streak, no multiplier


class TestGetGoalProgress:
    def test_empty_progress(self, session):
        member = make_member(session)
        result = get_goal_progress(session, member.id, "default")
        assert result == []

    def test_progress_with_completions(self, session):
        member = make_member(session)
        goal = make_goal(session, member_id=member.id)
        today = dt.date.today()
        make_goal_completion(
            session,
            goal_id=goal.id,
            member_id=member.id,
            date=today,
            points_earned=10,
        )
        result = get_goal_progress(session, member.id, "default", days=7)
        assert len(result) == 1
        assert result[0]["points_total"] == 10
        assert len(result[0]["completions"]) == 1
