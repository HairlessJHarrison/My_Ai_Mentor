"""Tests for csv_importer and csv_importer_v2."""

from services.csv_importer import parse_csv
from services.csv_importer_v2 import parse_csv_with_mapping, preview_csv


class TestParseCsv:
    def test_standard_csv(self):
        csv_data = "date,description,amount,category\n2026-03-01,Grocery Store,-45.50,groceries\n"
        result = parse_csv(csv_data)
        assert len(result["transactions"]) == 1
        assert result["transactions"][0]["amount"] == -45.50
        assert result["transactions"][0]["category"] == "groceries"
        assert result["skipped"] == 0

    def test_column_alias_detection(self):
        csv_data = "Transaction Date,Memo,Debit\n2026-03-01,Gas Station,-30.00\n"
        result = parse_csv(csv_data)
        assert len(result["transactions"]) == 1
        assert result["transactions"][0]["description"] == "Gas Station"

    def test_empty_csv(self):
        result = parse_csv("")
        assert result["transactions"] == []
        assert "Empty or invalid CSV file" in result["errors"]

    def test_amount_cleaning_dollar_sign_and_commas(self):
        csv_data = "date,description,amount\n2026-03-01,Big Purchase,\"$1,234.56\"\n"
        result = parse_csv(csv_data)
        assert result["transactions"][0]["amount"] == 1234.56

    def test_amount_cleaning_parens_negative(self):
        csv_data = "date,description,amount\n2026-03-01,Refund,(45.00)\n"
        result = parse_csv(csv_data)
        assert result["transactions"][0]["amount"] == -45.00

    def test_skip_empty_rows(self):
        csv_data = "date,description,amount\n,,\n2026-03-01,Valid,-10.00\n"
        result = parse_csv(csv_data)
        assert len(result["transactions"]) == 1
        assert result["skipped"] == 1

    def test_bad_amount_tracked_as_error(self):
        csv_data = "date,description,amount\n2026-03-01,Bad,notanumber\n"
        result = parse_csv(csv_data)
        assert len(result["transactions"]) == 0
        assert result["skipped"] == 1
        assert len(result["errors"]) == 1

    def test_default_category_when_missing(self):
        csv_data = "date,description,amount\n2026-03-01,Test,-10.00\n"
        result = parse_csv(csv_data)
        assert result["transactions"][0]["category"] == "other"


class TestParseCsvWithMapping:
    def test_explicit_mapping(self):
        csv_data = "Date,Desc,Amt\n2026-03-01,Coffee,-4.50\n"
        mapping = {"date_col": "Date", "amount_col": "Amt", "description_col": "Desc"}
        result = parse_csv_with_mapping(csv_data, mapping)
        assert len(result["transactions"]) == 1
        assert result["transactions"][0]["amount"] == -4.50

    def test_amount_sign_invert(self):
        csv_data = "Date,Desc,Amt\n2026-03-01,Coffee,4.50\n"
        mapping = {"date_col": "Date", "amount_col": "Amt", "description_col": "Desc"}
        result = parse_csv_with_mapping(csv_data, mapping, amount_sign="invert")
        assert result["transactions"][0]["amount"] == -4.50

    def test_skip_rows(self):
        csv_data = "Bank Statement\nAccount: 1234\nDate,Desc,Amt\n2026-03-01,Coffee,-4.50\n"
        mapping = {
            "date_col": "Date", "amount_col": "Amt",
            "description_col": "Desc", "skip_rows": 2,
        }
        result = parse_csv_with_mapping(csv_data, mapping)
        assert len(result["transactions"]) == 1

    def test_empty_csv(self):
        result = parse_csv_with_mapping("", {})
        assert result["transactions"] == []


class TestPreviewCsv:
    def test_preview_max_rows(self):
        rows = "\n".join(
            [f"2026-03-{i:02d},Item{i},-{i}.00" for i in range(1, 11)]
        )
        csv_data = f"Date,Desc,Amt\n{rows}\n"
        mapping = {"date_col": "Date", "amount_col": "Amt", "description_col": "Desc"}
        result = preview_csv(csv_data, mapping, max_rows=3)
        assert len(result["rows"]) == 3

    def test_preview_no_transactions_warning(self):
        result = preview_csv("Date,Desc,Amt\n", {})
        assert any("No transactions parsed" in w for w in result["warnings"])
