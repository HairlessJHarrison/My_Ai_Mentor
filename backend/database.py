import os
from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/unplugged.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def migrate_chore_schedule_columns():
    """Add schedule columns to chores table if they don't exist."""
    import sqlite3
    # Skip for in-memory databases (test environment uses sqlite://)
    if DATABASE_URL in ("sqlite://", "sqlite:///"):
        return  # In-memory DB — schema is created fresh by create_db_and_tables()
    db_path = DATABASE_URL.replace("sqlite:///", "")
    if not db_path or db_path == DATABASE_URL:
        return  # Could not extract a valid file path
    conn = sqlite3.connect(db_path)
    for col, col_type in [
        ("schedule_day", "INTEGER"),
        ("schedule_week_of_month", "INTEGER"),
        ("schedule_anchor_date", "TEXT"),
    ]:
        try:
            conn.execute(f"ALTER TABLE chores ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError:
            pass  # column already exists

    # Add participant_member_ids to activities table
    try:
        conn.execute("ALTER TABLE activities ADD COLUMN participant_member_ids TEXT DEFAULT '[]'")
    except sqlite3.OperationalError:
        pass  # column already exists

    conn.commit()
    conn.close()


def get_session():
    with Session(engine) as session:
        yield session
