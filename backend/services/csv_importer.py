"""CSV importer — parse bank CSV files into Transaction records."""

import csv
import io
from typing import Any


# Common column name mappings for bank CSVs
COLUMN_ALIASES = {
    "date": ["date", "transaction date", "posting date", "trans date"],
    "description": ["description", "memo", "details", "narrative", "payee"],
    "amount": ["amount", "debit", "value", "sum"],
    "category": ["category", "type", "transaction type"],
}


def parse_csv(file_content: str) -> dict[str, Any]:
    """Parse a bank CSV file and extract transaction-like rows.

    Returns: {
        transactions: [{date, description, amount, category}],
        skipped: int,
        errors: [str]
    }
    """
    reader = csv.DictReader(io.StringIO(file_content))
    if not reader.fieldnames:
        return {"transactions": [], "skipped": 0, "errors": ["Empty or invalid CSV file"]}

    # Map CSV columns to our field names
    field_map = _map_columns(reader.fieldnames)

    transactions: list[dict] = []
    skipped = 0
    errors: list[str] = []

    for row_num, row in enumerate(reader, start=2):  # start=2 because row 1 is header
        try:
            date_val = row.get(field_map.get("date", ""), "").strip()
            desc_val = row.get(field_map.get("description", ""), "").strip()
            amount_str = row.get(field_map.get("amount", ""), "").strip()
            category_val = row.get(field_map.get("category", ""), "other").strip()

            if not date_val or not amount_str:
                skipped += 1
                continue

            # Clean amount: remove $, commas, handle parens for negatives
            amount_str = amount_str.replace("$", "").replace(",", "")
            if amount_str.startswith("(") and amount_str.endswith(")"):
                amount_str = "-" + amount_str[1:-1]

            amount = float(amount_str)

            transactions.append({
                "date": date_val,
                "description": desc_val or "Imported transaction",
                "amount": amount,
                "category": category_val.lower() if category_val else "other",
            })
        except (ValueError, KeyError) as e:
            errors.append(f"Row {row_num}: {str(e)}")
            skipped += 1

    return {
        "transactions": transactions,
        "skipped": skipped,
        "errors": errors,
    }


def _map_columns(fieldnames: list[str]) -> dict[str, str]:
    """Map CSV column names to our expected field names using aliases."""
    mapping: dict[str, str] = {}
    lower_fields = {f.lower().strip(): f for f in fieldnames}

    for our_field, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in lower_fields:
                mapping[our_field] = lower_fields[alias]
                break

    return mapping
