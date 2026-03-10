"""Tests for free_block_finder — pure functions, no DB needed."""

import datetime as dt

from models.schedule import ScheduleEvent
from services.free_block_finder import find_free_blocks, find_free_blocks_multi_day


def _evt(date, start, end, participants=None):
    """Create a minimal ScheduleEvent for testing."""
    return ScheduleEvent(
        household_id="default",
        date=date,
        start_time=start,
        end_time=end,
        title="test",
        event_type="appointment",
        participants=participants or [],
    )


TODAY = dt.date(2026, 3, 10)


class TestFindFreeBlocks:
    def test_no_events_full_day_free(self):
        blocks = find_free_blocks([], TODAY)
        assert len(blocks) == 1
        assert blocks[0]["start"] == "06:00:00"
        assert blocks[0]["end"] == "22:00:00"
        assert blocks[0]["duration_min"] == 960

    def test_single_event_two_blocks(self):
        events = [_evt(TODAY, dt.time(10, 0), dt.time(12, 0))]
        blocks = find_free_blocks(events, TODAY)
        assert len(blocks) == 2
        assert blocks[0]["start"] == "06:00:00"
        assert blocks[0]["end"] == "10:00:00"
        assert blocks[0]["duration_min"] == 240
        assert blocks[1]["start"] == "12:00:00"
        assert blocks[1]["end"] == "22:00:00"
        assert blocks[1]["duration_min"] == 600

    def test_overlapping_events_merged(self):
        events = [
            _evt(TODAY, dt.time(10, 0), dt.time(12, 0)),
            _evt(TODAY, dt.time(11, 0), dt.time(14, 0)),
        ]
        blocks = find_free_blocks(events, TODAY)
        assert len(blocks) == 2
        assert blocks[0]["end"] == "10:00:00"
        assert blocks[1]["start"] == "14:00:00"

    def test_event_fills_entire_day(self):
        events = [_evt(TODAY, dt.time(6, 0), dt.time(22, 0))]
        blocks = find_free_blocks(events, TODAY)
        assert len(blocks) == 0

    def test_min_block_filter(self):
        # 10-min gap between 10:00 and 10:10
        events = [
            _evt(TODAY, dt.time(6, 0), dt.time(10, 0)),
            _evt(TODAY, dt.time(10, 10), dt.time(22, 0)),
        ]
        blocks = find_free_blocks(events, TODAY, min_block_min=15)
        assert len(blocks) == 0

        blocks = find_free_blocks(events, TODAY, min_block_min=10)
        assert len(blocks) == 1

    def test_custom_day_boundaries(self):
        blocks = find_free_blocks(
            [], TODAY,
            day_start=dt.time(8, 0),
            day_end=dt.time(18, 0),
        )
        assert blocks[0]["start"] == "08:00:00"
        assert blocks[0]["end"] == "18:00:00"
        assert blocks[0]["duration_min"] == 600

    def test_events_on_different_date_ignored(self):
        tomorrow = TODAY + dt.timedelta(days=1)
        events = [_evt(tomorrow, dt.time(10, 0), dt.time(12, 0))]
        blocks = find_free_blocks(events, TODAY)
        assert len(blocks) == 1
        assert blocks[0]["duration_min"] == 960


class TestFindFreeBlocksMultiDay:
    def test_multi_day_no_events(self):
        blocks = find_free_blocks_multi_day([], TODAY, days=3)
        assert len(blocks) == 3
        for b in blocks:
            assert b["duration_min"] == 960

    def test_multi_day_with_events(self):
        events = [_evt(TODAY, dt.time(10, 0), dt.time(12, 0))]
        blocks = find_free_blocks_multi_day(events, TODAY, days=2)
        # Day 1 has 2 blocks, day 2 has 1 block
        day1_blocks = [b for b in blocks if b["date"] == TODAY.isoformat()]
        day2_blocks = [b for b in blocks if b["date"] != TODAY.isoformat()]
        assert len(day1_blocks) == 2
        assert len(day2_blocks) == 1

    def test_overlapping_members_tracked(self):
        events = [
            _evt(TODAY, dt.time(10, 0), dt.time(12, 0), participants=["Alice"]),
        ]
        blocks = find_free_blocks_multi_day(events, TODAY, days=1)
        # During the free blocks, Alice is free (she's busy 10-12, free before/after)
        morning = blocks[0]  # 06:00-10:00
        assert "Alice" in morning["overlapping_members"]
