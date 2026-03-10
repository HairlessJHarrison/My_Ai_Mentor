"""Tests for budgets API endpoints."""

import datetime as dt
import io

from tests.conftest import make_budget, make_transaction


class TestGetSummary:
    def test_empty(self, client):
        month = f"{dt.date.today().year}-{dt.date.today().month:02d}"
        resp = client.get(f"/api/v1/budgets/summary?month={month}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["categories"] == []
        assert data["total_limit"] == 0
        assert data["total_spent"] == 0

    def test_with_data(self, client, session):
        today = dt.date.today()
        month = f"{today.year}-{today.month:02d}"
        make_budget(session, category="groceries", limit_amount=500.0, month=month)
        make_transaction(session, amount=-100.0, category="groceries", date=today)
        resp = client.get(f"/api/v1/budgets/summary?month={month}")
        data = resp.json()
        assert len(data["categories"]) == 1
        assert data["categories"][0]["spent"] == 100.0
        assert data["categories"][0]["remaining"] == 400.0
        assert data["total_limit"] == 500.0

    def test_unbudgeted_category(self, client, session):
        today = dt.date.today()
        month = f"{today.year}-{today.month:02d}"
        make_transaction(session, amount=-50.0, category="entertainment", date=today)
        resp = client.get(f"/api/v1/budgets/summary?month={month}")
        data = resp.json()
        ent = [c for c in data["categories"] if c["category"] == "entertainment"]
        assert len(ent) == 1
        assert ent[0]["limit"] == 0
        assert ent[0]["pct_used"] == 100.0


class TestCreateBudget:
    def test_create(self, client):
        resp = client.post("/api/v1/budgets", json={
            "household_id": "default",
            "month": "2026-03",
            "category": "groceries",
            "limit_amount": 500.0,
        })
        assert resp.status_code == 201

    def test_upsert(self, client):
        body = {
            "household_id": "default",
            "month": "2026-03",
            "category": "groceries",
            "limit_amount": 500.0,
        }
        client.post("/api/v1/budgets", json=body)
        body["limit_amount"] = 600.0
        resp = client.post("/api/v1/budgets", json=body)
        assert resp.json()["limit_amount"] == 600.0


class TestTransactions:
    def test_create_and_list(self, client):
        today = dt.date.today()
        month = f"{today.year}-{today.month:02d}"
        resp = client.post("/api/v1/budgets/transactions", json={
            "household_id": "default",
            "date": today.isoformat(),
            "amount": -25.0,
            "description": "Coffee",
            "category": "dining",
        })
        assert resp.status_code == 201

        resp = client.get(f"/api/v1/budgets/transactions?month={month}")
        assert len(resp.json()) == 1

    def test_category_filter(self, client, session):
        today = dt.date.today()
        month = f"{today.year}-{today.month:02d}"
        make_transaction(session, category="groceries", date=today)
        make_transaction(session, category="dining", date=today, description="Coffee")
        resp = client.get(f"/api/v1/budgets/transactions?month={month}&category=groceries")
        assert len(resp.json()) == 1


class TestCsvMappings:
    def test_create_and_list(self, client):
        resp = client.post("/api/v1/budgets/csv-mappings", json={
            "household_id": "default",
            "name": "Chase Checking",
            "account_type": "checking",
            "column_map": {"date_col": "Date", "amount_col": "Amount", "description_col": "Description"},
        })
        assert resp.status_code == 201

        resp = client.get("/api/v1/budgets/csv-mappings")
        assert len(resp.json()) == 1


class TestCsvImport:
    def _upload_csv(self, client, csv_content, mapping_id=None):
        """Helper to upload a CSV file."""
        files = {"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")}
        params = {}
        if mapping_id:
            params["mapping_id"] = mapping_id
        return client.post("/api/v1/budgets/import-csv", files=files, params=params)

    def test_auto_detect(self, client):
        csv_data = "date,description,amount,category\n2026-03-01,Store,-45.50,groceries\n"
        resp = self._upload_csv(client, csv_data)
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported_count"] == 1
        assert data["skipped"] == 0

    def test_bad_mapping_id(self, client):
        csv_data = "date,description,amount\n2026-03-01,Store,-10\n"
        resp = self._upload_csv(client, csv_data, mapping_id=999)
        assert resp.status_code == 404

    def test_preview(self, client):
        csv_data = "date,description,amount\n2026-03-01,A,-10\n2026-03-02,B,-20\n"
        files = {"file": ("test.csv", io.BytesIO(csv_data.encode()), "text/csv")}
        resp = client.post("/api/v1/budgets/import-csv/preview", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert "rows" in data


class TestForecast:
    def test_empty(self, client):
        resp = client.get("/api/v1/budgets/forecast")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["months"]) == 3

    def test_with_transactions(self, client, session):
        today = dt.date.today()
        make_transaction(session, amount=-100.0, date=today)
        resp = client.get("/api/v1/budgets/forecast?months=1")
        data = resp.json()
        assert len(data["months"]) == 1
        assert data["months"][0]["projected_spend"] > 0
