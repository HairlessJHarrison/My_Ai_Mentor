"""Budget forecaster — simple linear spending projection."""

import datetime as dt
from models.transaction import Transaction


def forecast_spending(
    transactions: list[Transaction],
    current_month: str,
    months_ahead: int = 3,
) -> list[dict]:
    """Project spending for the next N months based on current month trajectory.

    Args:
        transactions: All transactions for the current month.
        current_month: YYYY-MM format string.
        months_ahead: Number of months to project.

    Returns: [{month, projected_spend, projected_remaining}]
    """
    # Calculate current month's daily spend rate
    year, month = int(current_month[:4]), int(current_month[5:7])
    month_start = dt.date(year, month, 1)

    today = dt.date.today()
    if today.year == year and today.month == month:
        days_elapsed = (today - month_start).days + 1
    else:
        # If viewing a past month, use full month
        if month == 12:
            next_month_start = dt.date(year + 1, 1, 1)
        else:
            next_month_start = dt.date(year, month + 1, 1)
        days_elapsed = (next_month_start - month_start).days

    total_spent = sum(abs(t.amount) for t in transactions if t.amount < 0)
    daily_rate = total_spent / max(days_elapsed, 1)

    results: list[dict] = []
    for i in range(1, months_ahead + 1):
        proj_month = month + i
        proj_year = year
        while proj_month > 12:
            proj_month -= 12
            proj_year += 1

        # Days in the projected month
        if proj_month == 12:
            days_in_month = (dt.date(proj_year + 1, 1, 1) - dt.date(proj_year, 12, 1)).days
        else:
            days_in_month = (dt.date(proj_year, proj_month + 1, 1) - dt.date(proj_year, proj_month, 1)).days

        projected = round(daily_rate * days_in_month, 2)
        results.append({
            "month": f"{proj_year}-{proj_month:02d}",
            "projected_spend": projected,
            "projected_remaining": None,  # Will be filled if budgets are provided
        })

    return results
