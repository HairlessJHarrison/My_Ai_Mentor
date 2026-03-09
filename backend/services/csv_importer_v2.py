"""Enhanced CSV importer — supports saved column mapping profiles."""

import csv
import io
from typing import Any


def parse_csv_with_mapping(
    file_content: str,
    column_map: dict,
    amount_sign: str = "as_is",
) -> dict[str, Any]:
    """Parse a bank CSV file using an explicit column mapping.

    column_map should contain:
        date_col: str — CSV column name for date
        amount_col: str — CSV column name for amount
        description_col: str — CSV column name for description
        category_col: str | None — CSV column name for category (optional)
        skip_rows: int — number of header rows to skip (default 0)
        date_format: str | None — strftime format (e.g. "%m/%d/%Y"), None for auto

    amount_sign:
        "as_is" — use amount as-is
        "invert" — multiply by -1 (for credit card statements where debits are positive)

    Returns: {transactions: [...], skipped: int, errors: [str]}
    """
    date_col = column_map.get("date_col", "")
    amount_col = column_map.get("amount_col", "")
    description_col = column_map.get("description_col", "")
    category_col = column_map.get("category_col")
    skip_rows = column_map.get("skip_rows", 0)

    lines = file_content.splitlines()
    if skip_rows > 0:
        lines = lines[skip_rows:]

    reader = csv.DictReader(io.StringIO("\n".join(lines)))
    if not reader.fieldnames:
        return {"transactions": [], "skipped": 0, "errors": ["Empty or invalid CSV file"]}

    transactions: list[dict] = []
    skipped = 0
    errors: list[str] = []

    for row_num, row in enumerate(reader, start=2 + skip_rows):
        try:
            date_val = row.get(date_col, "").strip()
            amount_str = row.get(amount_col, "").strip()
            desc_val = row.get(description_col, "").strip()
            category_val = row.get(category_col, "other").strip() if category_col else "other"

            if not date_val or not amount_str:
                skipped += 1
                continue

            # Clean amount
            amount_str = amount_str.replace("$", "").replace(",", "")
            if amount_str.startswith("(") and amount_str.endswith(")"):
                amount_str = "-" + amount_str[1:-1]

            amount = float(amount_str)

            if amount_sign == "invert":
                amount = -amount

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


def preview_csv(
    file_content: str,
    column_map: dict,
    amount_sign: str = "as_is",
    max_rows: int = 5,
) -> dict[str, Any]:
    """Preview the first N rows of a CSV with mapping applied.

    Returns: {rows: [...], warnings: [str]}
    """
    result = parse_csv_with_mapping(file_content, column_map, amount_sign)
    warnings = result["errors"][:5]

    if not result["transactions"]:
        warnings.append("No transactions parsed. Check your column mapping.")

    return {
        "rows": result["transactions"][:max_rows],
        "warnings": warnings,
    }
