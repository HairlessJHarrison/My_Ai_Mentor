"""CSV column mapping model — saved profiles for bank statement imports."""

import datetime as dt
from typing import Literal
from sqlalchemy import String
from sqlmodel import SQLModel, Field, Column, JSON


class CsvColumnMappingBase(SQLModel):
    household_id: str = Field(description="Household identifier")
    name: str = Field(description="Mapping profile name, e.g. 'Chase Checking', 'Amex Credit'")
    account_type: str = Field(description="Type of bank account: checking, credit_card, savings", sa_column=Column(String))
    column_map: dict = Field(sa_column=Column(JSON), description="Maps CSV columns to fields: {date_col, amount_col, description_col, category_col?, skip_rows?, date_format?}")
    amount_sign: str = Field(default="as_is", description="Whether to invert amount sign: as_is, invert", sa_column=Column(String))


class CsvColumnMapping(CsvColumnMappingBase, table=True):
    __tablename__ = "csv_column_mappings"

    id: int | None = Field(default=None, primary_key=True)
    created_at: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.timezone.utc))


class CsvColumnMappingCreate(SQLModel):
    household_id: str = Field(description="Household identifier")
    name: str = Field(description="Mapping profile name")
    account_type: Literal["checking", "credit_card", "savings"] = Field(description="Type of bank account")
    column_map: dict = Field(description="Column mapping configuration")
    amount_sign: Literal["as_is", "invert"] = Field(default="as_is", description="Whether to invert amount sign")
