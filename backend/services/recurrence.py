"""Recurrence rule expander — converts iCal RRULE dicts to occurrence dates."""

import datetime as dt
import logging
from types import SimpleNamespace
from typing import Any

from dateutil.rrule import rrulestr

logger = logging.getLogger("unplugged.recurrence")


def _rule_dict_to_rrulestr(rule: dict, dtstart: dt.datetime) -> str:
    """Convert a stored recurrence_rule dict to a string accepted by dateutil.rrulestr.

    The dict mirrors RRULE component properties::

        {"FREQ": "WEEKLY", "BYDAY": "MO,WE", "INTERVAL": 2}

    An optional "DTSTART" key (ISO date string or YYYYMMDD) overrides dtstart.
    List values are joined with commas (e.g. {"BYDAY": ["MO", "WE"]}).
    """
    # Pull out optional DTSTART override (case-insensitive)
    rule_upper = {k.upper(): v for k, v in rule.items()}
    dtstart_override = rule_upper.pop("DTSTART", None)

    if dtstart_override:
        try:
            if isinstance(dtstart_override, str) and len(dtstart_override) == 8:
                # YYYYMMDD format
                dtstart = dt.datetime.strptime(dtstart_override, "%Y%m%d")
            elif isinstance(dtstart_override, str):
                dtstart = dt.datetime.fromisoformat(dtstart_override)
        except ValueError:
            pass  # fall back to provided dtstart

    parts = []
    for key, val in rule_upper.items():
        if isinstance(val, list):
            parts.append(f"{key}={','.join(str(v) for v in val)}")
        else:
            parts.append(f"{key}={val}")

    rrule_part = "RRULE:" + ";".join(parts)
    dtstart_str = dtstart.strftime("%Y%m%dT%H%M%S")
    return f"DTSTART:{dtstart_str}\n{rrule_part}"


def expand_recurrence(
    base_event: Any,
    start_date: dt.date,
    end_date: dt.date,
) -> list[dict]:
    """Expand a recurring event into occurrence dicts within [start_date, end_date].

    Each returned dict is a copy of ``base_event.model_dump(mode="json")`` with
    ``date`` overridden to the occurrence date and ``recurrence_instance: True``
    added.  Returns an empty list for events without a recurrence_rule.
    """
    if not base_event.recurrence_rule:
        return []

    dtstart = dt.datetime.combine(base_event.date, base_event.start_time)
    try:
        rule_str = _rule_dict_to_rrulestr(base_event.recurrence_rule, dtstart)
        rule_set = rrulestr(rule_str, ignoretz=True)
    except Exception:
        logger.exception(
            "Failed to parse recurrence rule for event id=%s: %r",
            getattr(base_event, "id", "?"),
            base_event.recurrence_rule,
        )
        return []

    window_start = dt.datetime.combine(start_date, dt.time(0, 0))
    window_end = dt.datetime.combine(end_date, dt.time(23, 59, 59))
    occurrences = rule_set.between(window_start, window_end, inc=True)

    base_dict = base_event.model_dump(mode="json")
    results = []
    for occurrence in occurrences:
        instance = dict(base_dict)
        instance["date"] = occurrence.date().isoformat()
        instance["recurrence_instance"] = True
        results.append(instance)

    return results


def instance_as_event_like(d: dict) -> SimpleNamespace:
    """Convert a recurring-instance dict to a duck-typed event object.

    The returned object exposes the attributes consumed by find_free_blocks:
    ``date``, ``start_time``, ``end_time``, ``participants``, and
    ``assigned_member_ids``.
    """
    date_val = d["date"]
    start_val = d["start_time"]
    end_val = d["end_time"]

    return SimpleNamespace(
        date=dt.date.fromisoformat(date_val) if isinstance(date_val, str) else date_val,
        start_time=dt.time.fromisoformat(start_val) if isinstance(start_val, str) else start_val,
        end_time=dt.time.fromisoformat(end_val) if isinstance(end_val, str) else end_val,
        participants=d.get("participants") or [],
        assigned_member_ids=d.get("assigned_member_ids") or [],
    )
