import datetime as dt
from sqlmodel import SQLModel, Field


class BudgetBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    month: str = Field(description="Budget month in YYYY-MM format", index=True)
    category: str = Field(description="Budget category matching transaction categories")
    limit_amount: float = Field(description="Monthly budget limit in USD")
    notes: str | None = Field(default=None, description="Optional notes about this budget line")


class Budget(BudgetBase, table=True):
    __tablename__ = "budgets"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class BudgetCreate(BudgetBase):
    pass
