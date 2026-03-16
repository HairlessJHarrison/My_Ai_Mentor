"""Tests for scoring API — participant_member_ids per-member refactor."""

import datetime as dt

from tests.conftest import make_member, make_activity


class TestLogActivityWithMemberIds:
    def test_log_with_member_ids(self, client, session):
        """participant_member_ids is stored and participants_count is auto-inferred."""
        m1 = make_member(session, name="Alice")
        m2 = make_member(session, name="Bob")
        resp = client.post("/api/v1/scoring/log-activity", json={
            "activity_type": "screen_free_family",
            "duration_min": 60,
            "participants_count": 1,  # should be overridden to 2
            "participant_member_ids": [m1.id, m2.id],
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["participants_count"] == 2
        assert data["participant_member_ids"] == [m1.id, m2.id]

    def test_log_without_member_ids(self, client):
        """Without member IDs, participants_count is used as-is."""
        resp = client.post("/api/v1/scoring/log-activity", json={
            "activity_type": "outdoor",
            "duration_min": 30,
            "participants_count": 3,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["participants_count"] == 3
        assert data["participant_member_ids"] == []

    def test_member_ids_empty_list(self, client):
        """Explicit empty list is valid — acts like the old behavior."""
        resp = client.post("/api/v1/scoring/log-activity", json={
            "activity_type": "shared_meal",
            "duration_min": 30,
            "participants_count": 4,
            "participant_member_ids": [],
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["participants_count"] == 4
        assert data["participant_member_ids"] == []

    def test_multiplier_applied_with_member_ids(self, client, session):
        """2+ participant members should trigger the multiplier."""
        m1 = make_member(session, name="Alice")
        m2 = make_member(session, name="Bob")
        m3 = make_member(session, name="Charlie")
        resp = client.post("/api/v1/scoring/log-activity", json={
            "activity_type": "screen_free_family",
            "duration_min": 60,
            "participants_count": 1,
            "participant_member_ids": [m1.id, m2.id, m3.id],
        })
        data = resp.json()
        assert data["points_earned"] == 15  # 10 base * 1.5 multiplier
        assert len(data["multipliers_applied"]) == 1


class TestMemberScoreWithMemberIds:
    def test_score_filters_by_participant(self, client, session):
        """Member score only counts activities where that member participated."""
        m1 = make_member(session, name="Alice")
        m2 = make_member(session, name="Bob")

        # Activity with only Alice
        make_activity(session, points_earned=20, participant_member_ids=[m1.id])
        # Activity with only Bob
        make_activity(session, points_earned=10, participant_member_ids=[m2.id])

        resp1 = client.get(f"/api/v1/members/{m1.id}/score?period=all")
        assert resp1.json()["breakdown"]["activities"] == 20

        resp2 = client.get(f"/api/v1/members/{m2.id}/score?period=all")
        assert resp2.json()["breakdown"]["activities"] == 10

    def test_score_shared_activity(self, client, session):
        """Both members get points for a shared activity."""
        m1 = make_member(session, name="Alice")
        m2 = make_member(session, name="Bob")

        make_activity(session, points_earned=30, participant_member_ids=[m1.id, m2.id])

        resp1 = client.get(f"/api/v1/members/{m1.id}/score?period=all")
        assert resp1.json()["breakdown"]["activities"] == 30

        resp2 = client.get(f"/api/v1/members/{m2.id}/score?period=all")
        assert resp2.json()["breakdown"]["activities"] == 30

    def test_score_legacy_activity_no_member_ids(self, client, session):
        """Activities without participant_member_ids (legacy) count for all members."""
        m1 = make_member(session, name="Alice")
        make_activity(session, points_earned=15, participant_member_ids=[])

        resp = client.get(f"/api/v1/members/{m1.id}/score?period=all")
        # Empty participant_member_ids = legacy = counts for all
        assert resp.json()["breakdown"]["activities"] == 15
