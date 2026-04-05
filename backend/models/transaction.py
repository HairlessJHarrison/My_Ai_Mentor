import datetime as dt
from typing import Literal
from sqlalchemy import String
from sqlmodel import SQLModel, Field, Column, JSON


class TransactionBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    date: dt.date = Field(description="Transaction date", index=True)
    amount: float = Field(description="Transaction amount (negative for expenses, positive for income)")
    description: str = Field(description="Transaction description from bank or manual entry")
    category: str = Field(description="Budget category: groceries, dining, transport, utilities, entertainment, health, housing, other")
    subcategory: str | None = Field(default=None, description="Optional subcategory for finer tracking")
    tags: list[str] = Field(default=[], sa_column=Column(JSON), description="Freeform tags for search")
    merchant_meta: dict | None = Field(default=None, sa_column=Column(JSON), description="Optional merchant details")
    source: str = Field(default="manual", description="How this transaction was created: manual, csv_import, openclaw, plaid", sa_column=Column(String))


class Transaction(TransactionBase, table=True):
    __tablename__ = "transactions"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


class TransactionCreate(TransactionBase):
    pass
