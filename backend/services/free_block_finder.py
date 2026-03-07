"""Free block finder — detects overlapping free time windows across events."""

import datetime as dt
from models.schedule import ScheduleEvent


def find_free_blocks(
    events: list[ScheduleEvent],
    target_date: dt.date,
    day_start: dt.time = dt.time(6, 0),
    day_end: dt.time = dt.time(22, 0),
    min_block_min: int = 15,
) -> list[dict]:
    """Find free time windows on a given date that don't overlap with any events.

    Returns a list of dicts: {start, end, duration_min}
    """
    # Filter events for the target date and sort by start_time
    day_events = sorted(
        [e for e in events if e.date == target_date],
        key=lambda e: e.start_time,
    )

    free_blocks: list[dict] = []
    cursor = day_start

    for event in day_events:
        # Skip events that end before the cursor or start after day_end
        if event.end_time <= cursor:
            continue
        if event.start_time >= day_end:
            break

        # If there's a gap between cursor and this event's start, it's free
        event_start = max(event.start_time, day_start)
        if event_start > cursor:
            duration = _time_diff_minutes(cursor, event_start)
            if duration >= min_block_min:
                free_blocks.append({
                    "start": cursor.isoformat(),
                    "end": event_start.isoformat(),
                    "duration_min": duration,
                })

        # Move cursor past this event
        cursor = max(cursor, min(event.end_time, day_end))

    # Check for free time after the last event until day_end
    if cursor < day_end:
        duration = _time_diff_minutes(cursor, day_end)
        if duration >= min_block_min:
            free_blocks.append({
                "start": cursor.isoformat(),
                "end": day_end.isoformat(),
                "duration_min": duration,
            })

    return free_blocks


def find_free_blocks_multi_day(
    events: list[ScheduleEvent],
    start_date: dt.date,
    days: int = 7,
    day_start: dt.time = dt.time(6, 0),
    day_end: dt.time = dt.time(22, 0),
    min_block_min: int = 15,
) -> list[dict]:
    """Find free blocks across multiple days.

    Returns list of dicts: {date, start, end, duration_min, overlapping_members}
    """
    results: list[dict] = []
    for offset in range(days):
        target = start_date + dt.timedelta(days=offset)
        blocks = find_free_blocks(events, target, day_start, day_end, min_block_min)
        for block in blocks:
            # Determine which members are free during this block
            block_start = dt.time.fromisoformat(block["start"])
            block_end = dt.time.fromisoformat(block["end"])
            day_events = [e for e in events if e.date == target]

            busy_members: set[str] = set()
            for evt in day_events:
                if evt.start_time < block_end and evt.end_time > block_start:
                    for p in (evt.participants or []):
                        busy_members.add(p)

            # Get all known members from events on this date
            all_members: set[str] = set()
            for evt in day_events:
                for p in (evt.participants or []):
                    all_members.add(p)

            free_members = sorted(all_members - busy_members)

            results.append({
                "date": target.isoformat(),
                "start": block["start"],
                "end": block["end"],
                "duration_min": block["duration_min"],
                "overlapping_members": free_members,
            })

    return results


def _time_diff_minutes(t1: dt.time, t2: dt.time) -> int:
    """Calculate the difference in minutes between two times (t2 - t1)."""
    d1 = dt.datetime.combine(dt.date.today(), t1)
    d2 = dt.datetime.combine(dt.date.today(), t2)
    return int((d2 - d1).total_seconds() / 60)
