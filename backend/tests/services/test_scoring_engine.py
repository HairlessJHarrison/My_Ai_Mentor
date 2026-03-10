"""Tests for scoring_engine — requires DB session for streak/cap queries."""

import datetime as dt

from tests.conftest import make_activity
from services.scoring_engine import calculate_points, get_streaks, get_weekly_trends


class TestCalculatePoints:
    def test_screen_free_family_base(self, session):
        points, mults = calculate_points("screen_free_family", 60, 1, session)
        assert points == 10  # 10 pts/hr * 1 hr * 1.0 (no multiplier for 1 participant)
        assert mults == []

    def test_screen_free_family_multiplier_2_participants(self, session):
        points, mults = calculate_points("screen_free_family", 60, 2, session)
        assert points == 15  # 10 * 1.5
        assert "2+ participants" in mults

    def test_outdoor_base(self, session):
        points, _ = calculate_points("outdoor", 60, 1, session)
        assert points == 15  # 15 pts/hr, no multiplier (1 participant)

    def test_outdoor_multiplier(self, session):
        points, mults = calculate_points("outdoor", 60, 2, session)
        assert points == 30  # 15 * 2.0
        assert len(mults) == 1

    def test_shared_meal_flat_rate(self, session):
        points, _ = calculate_points("shared_meal", 30, 1, session)
        assert points == 8  # flat per-meal, not per-hour

    def test_shared_meal_home_cooked_multiplier(self, session):
        points, mults = calculate_points(
            "shared_meal", 30, 1, session,
            details={"home_cooked": True},
        )
        assert points == 10  # 8 * 1.3 = 10.4 -> rounded to 10
        assert len(mults) == 1

    def test_one_on_one_protected_block(self, session):
        points, mults = calculate_points(
            "one_on_one", 60, 1, session,
            details={"protected_block": True},
        )
        assert points == 40  # 20 * 2.0

    def test_unknown_type_uses_other(self, session):
        points, _ = calculate_points("unknown_type", 60, 1, session)
        assert points == 5  # "other": 5 pts/hr

    def test_daily_cap_enforced(self, session):
        # Max for screen_free_family is 60 pts/day
        # Pre-seed 55 points
        make_activity(session, points_earned=55, multipliers_applied=[])
        points, _ = calculate_points("screen_free_family", 60, 2, session)
        # Would earn 15, but only 5 remaining before cap
        assert points == 5

    def test_game_creative_streak_multiplier(self, session):
        # Seed 2 consecutive days of game_creative
        today = dt.date.today()
        make_activity(session, activity_type="game_creative", date=today - dt.timedelta(days=1), points_earned=10)
        make_activity(session, activity_type="game_creative", date=today - dt.timedelta(days=2), points_earned=10)
        points, mults = calculate_points("game_creative", 60, 1, session)
        assert points == 18  # 12 * 1.5 = 18
        assert any("streak" in m.lower() for m in mults)


class TestGetStreaks:
    def test_no_streaks(self, session):
        result = get_streaks(session)
        assert result == []

    def test_streak_detected(self, session):
        today = dt.date.today()
        for i in range(1, 4):
            make_activity(
                session,
                activity_type="outdoor",
                date=today - dt.timedelta(days=i),
                points_earned=10,
            )
        result = get_streaks(session)
        assert len(result) == 1
        assert result[0]["activity_type"] == "outdoor"
        assert result[0]["consecutive_days"] == 3
        assert result[0]["points_bonus"] == 15  # 3 * 5


class TestGetWeeklyTrends:
    def test_empty_trends(self, session):
        result = get_weekly_trends(session, weeks=2)
        assert len(result) == 2
        for week in result:
            assert week["total_points"] == 0

    def test_trends_with_data(self, session):
        today = dt.date.today()
        make_activity(session, date=today, points_earned=20)
        result = get_weekly_trends(session, weeks=1)
        assert result[0]["total_points"] == 20
        assert result[0]["activity_count"] == 1
