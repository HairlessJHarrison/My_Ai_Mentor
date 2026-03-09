"""Budget module — budget CRUD, transactions, CSV import, forecast."""

import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlmodel import Session, select

from auth import verify_api_key
from database import get_session
from models.budget import Budget, BudgetCreate
from models.transaction import Transaction, TransactionCreate
from services.csv_importer import parse_csv
from services.csv_importer_v2 import parse_csv_with_mapping, preview_csv
from services.budget_forecaster import forecast_spending
from models.csv_mapping import CsvColumnMapping, CsvColumnMappingCreate
from websocket import manager

router = APIRouter(prefix="/api/v1/budgets", tags=["Budgets"])

HOUSEHOLD_ID = "default"


def _resolve_month(month: str | None) -> str:
    """Resolve 'current' or None to YYYY-MM format."""
    if not month or month == "current":
        today = dt.date.today()
        return f"{today.year}-{today.month:02d}"
    return month


@router.get("/summary")
async def get_summary(
    month: str = Query("current", description="YYYY-MM or 'current'"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Budget vs. actual by category for a month."""
    month_str = _resolve_month(month)

    # Get budgets for this month
    budgets = session.exec(
        select(Budget).where(Budget.month == month_str)
    ).all()

    # Get transactions for this month
    year, mo = int(month_str[:4]), int(month_str[5:7])
    start_date = dt.date(year, mo, 1)
    if mo == 12:
        end_date = dt.date(year + 1, 1, 1)
    else:
        end_date = dt.date(year, mo + 1, 1)

    transactions = session.exec(
        select(Transaction).where(
            Transaction.date >= start_date,
            Transaction.date < end_date,
        )
    ).all()

    # Build category summary
    spent_by_category: dict[str, float] = {}
    for t in transactions:
        if t.amount < 0:  # expenses only
            cat = t.category or "other"
            spent_by_category[cat] = spent_by_category.get(cat, 0) + abs(t.amount)

    categories = []
    for b in budgets:
        spent = round(spent_by_category.get(b.category, 0), 2)
        remaining = round(b.limit_amount - spent, 2)
        pct_used = round((spent / b.limit_amount * 100), 1) if b.limit_amount > 0 else 0
        categories.append({
            "category": b.category,
            "limit": b.limit_amount,
            "spent": spent,
            "remaining": remaining,
            "pct_used": pct_used,
        })

    # Include categories with spending but no budget
    budgeted_cats = {b.category for b in budgets}
    for cat, spent in spent_by_category.items():
        if cat not in budgeted_cats:
            categories.append({
                "category": cat,
                "limit": 0,
                "spent": round(spent, 2),
                "remaining": round(-spent, 2),
                "pct_used": 100.0,
            })

    total_limit = round(sum(b.limit_amount for b in budgets), 2)
    total_spent = round(sum(c["spent"] for c in categories), 2)

    return {
        "month": month_str,
        "categories": categories,
        "total_limit": total_limit,
        "total_spent": total_spent,
    }


@router.post("", status_code=201)
async def create_budget(
    body: BudgetCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Create or update a budget line."""
    # Check if budget already exists for this month + category
    existing = session.exec(
        select(Budget).where(
            Budget.month == body.month,
            Budget.category == body.category,
            Budget.household_id == (body.household_id or HOUSEHOLD_ID),
        )
    ).first()

    if existing:
        existing.limit_amount = body.limit_amount
        existing.notes = body.notes
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    budget = Budget.model_validate(body, update={"household_id": body.household_id or HOUSEHOLD_ID})
    session.add(budget)
    session.commit()
    session.refresh(budget)
    return budget


@router.get("/transactions")
async def get_transactions(
    month: str = Query("current", description="YYYY-MM or 'current'"),
    category: Optional[str] = Query(None, description="Filter by category"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Filtered transaction list."""
    month_str = _resolve_month(month)
    year, mo = int(month_str[:4]), int(month_str[5:7])
    start_date = dt.date(year, mo, 1)
    if mo == 12:
        end_date = dt.date(year + 1, 1, 1)
    else:
        end_date = dt.date(year, mo + 1, 1)

    stmt = select(Transaction).where(
        Transaction.date >= start_date,
        Transaction.date < end_date,
    )
    if category:
        stmt = stmt.where(Transaction.category == category)

    transactions = session.exec(stmt).all()
    return [t.model_dump(mode="json") for t in transactions]


@router.post("/transactions", status_code=201)
async def create_transaction(
    body: TransactionCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Log a single transaction."""
    txn = Transaction.model_validate(body, update={"household_id": body.household_id or HOUSEHOLD_ID})
    session.add(txn)
    session.commit()
    session.refresh(txn)
    await manager.broadcast("transaction_logged", txn.model_dump(mode="json"))
    return txn


@router.get("/csv-mappings")
async def list_csv_mappings(
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """List saved CSV column mapping profiles."""
    mappings = session.exec(
        select(CsvColumnMapping).where(CsvColumnMapping.household_id == HOUSEHOLD_ID)
    ).all()
    return [m.model_dump(mode="json") for m in mappings]


@router.post("/csv-mappings", status_code=201)
async def create_csv_mapping(
    body: CsvColumnMappingCreate,
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Save a new column mapping profile."""
    mapping = CsvColumnMapping.model_validate(body)
    session.add(mapping)
    session.commit()
    session.refresh(mapping)
    return mapping


@router.post("/import-csv")
async def import_csv(
    file: UploadFile = File(...),
    mapping_id: Optional[int] = Query(None, description="Saved mapping profile ID"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Bulk import transactions from a bank CSV file.

    If mapping_id is provided, uses the saved column mapping profile.
    Otherwise falls back to auto-detection.
    """
    content = await file.read()
    file_text = content.decode("utf-8-sig")

    if mapping_id:
        mapping = session.get(CsvColumnMapping, mapping_id)
        if not mapping:
            raise HTTPException(status_code=404, detail="CSV mapping not found")
        result = parse_csv_with_mapping(file_text, mapping.column_map, mapping.amount_sign)
    else:
        result = parse_csv(file_text)

    imported_count = 0
    for t_data in result["transactions"]:
        try:
            txn = Transaction(
                household_id=HOUSEHOLD_ID,
                date=dt.date.fromisoformat(t_data["date"]),
                amount=t_data["amount"],
                description=t_data["description"],
                category=t_data["category"],
                source="csv_import",
            )
            session.add(txn)
            imported_count += 1
        except Exception as e:
            result["errors"].append(str(e))
            result["skipped"] += 1

    session.commit()

    return {
        "imported_count": imported_count,
        "skipped": result["skipped"],
        "errors": result["errors"],
    }


@router.post("/import-csv/preview")
async def preview_csv_import(
    file: UploadFile = File(...),
    mapping_id: Optional[int] = Query(None, description="Saved mapping profile ID"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Preview first 5 rows of a CSV with mapping applied before committing."""
    content = await file.read()
    file_text = content.decode("utf-8-sig")

    if mapping_id:
        mapping = session.get(CsvColumnMapping, mapping_id)
        if not mapping:
            raise HTTPException(status_code=404, detail="CSV mapping not found")
        return preview_csv(file_text, mapping.column_map, mapping.amount_sign)
    else:
        # Auto-detect: use legacy parser for preview
        result = parse_csv(file_text)
        return {
            "rows": result["transactions"][:5],
            "warnings": result["errors"][:5],
        }


@router.get("/forecast")
async def get_forecast(
    months: int = Query(3, ge=1, le=12, description="Number of months to forecast"),
    session: Session = Depends(get_session),
    _auth: str = Depends(verify_api_key),
):
    """Simple spending forecast based on current month trends."""
    month_str = _resolve_month("current")
    year, mo = int(month_str[:4]), int(month_str[5:7])
    start_date = dt.date(year, mo, 1)
    if mo == 12:
        end_date = dt.date(year + 1, 1, 1)
    else:
        end_date = dt.date(year, mo + 1, 1)

    transactions = session.exec(
        select(Transaction).where(
            Transaction.date >= start_date,
            Transaction.date < end_date,
        )
    ).all()

    forecast = forecast_spending(list(transactions), month_str, months)

    # Enrich with budget limits if available
    for proj in forecast:
        budgets = session.exec(
            select(Budget).where(Budget.month == proj["month"])
        ).all()
        if budgets:
            total_limit = sum(b.limit_amount for b in budgets)
            proj["projected_remaining"] = round(total_limit - proj["projected_spend"], 2)

    return {"months": forecast}
