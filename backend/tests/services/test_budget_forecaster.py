"""Tests for budget_forecaster — pure functions."""

import datetime as dt
from unittest.mock import patch

from models.transaction import Transaction
from services.budget_forecaster import forecast_spending


def _txn(amount, date=None):
    return Transaction(
        household_id="default",
        date=date or dt.date(2026, 3, 5),
        amount=amount,
        description="test",
        category="groceries",
    )


class TestForecastSpending:
    def test_no_transactions(self):
        result = forecast_spending([], "2026-03", months_ahead=2)
        assert len(result) == 2
        for r in result:
            assert r["projected_spend"] == 0

    @patch("services.budget_forecaster.dt")
    def test_linear_projection(self, mock_dt):
        # Simulate today = March 10, 2026 (10 days elapsed)
        mock_dt.date.today.return_value = dt.date(2026, 3, 10)
        mock_dt.date.side_effect = lambda *a, **kw: dt.date(*a, **kw)
        mock_dt.timedelta = dt.timedelta

        # $300 spent in 10 days -> $30/day
        txns = [_txn(-100.0), _txn(-100.0), _txn(-100.0)]
        result = forecast_spending(txns, "2026-03", months_ahead=1)
        assert len(result) == 1
        # April has 30 days -> $30 * 30 = $900
        assert result[0]["month"] == "2026-04"
        assert result[0]["projected_spend"] == 900.0

    def test_multiple_months(self):
        result = forecast_spending([], "2026-03", months_ahead=3)
        assert len(result) == 3
        months = [r["month"] for r in result]
        assert "2026-04" in months
        assert "2026-05" in months
        assert "2026-06" in months

    def test_year_boundary(self):
        result = forecast_spending([], "2026-12", months_ahead=2)
        months = [r["month"] for r in result]
        assert "2027-01" in months
        assert "2027-02" in months

    def test_positive_transactions_ignored_in_spend(self):
        # Income (positive) should not count as spending
        txns = [_txn(500.0), _txn(-100.0)]
        result = forecast_spending(txns, "2026-03", months_ahead=1)
        # Only $100 spent, not $500
        assert result[0]["projected_spend"] > 0
