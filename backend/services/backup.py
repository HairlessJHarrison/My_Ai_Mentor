"""Database backup service — atomic SQLite snapshots with retention management."""

import datetime as dt
import logging
import os
import sqlite3
from pathlib import Path

logger = logging.getLogger("unplugged.backup")

# Resolved at import time so the module can be used before the ORM engine starts.
_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/unplugged.db")
_BACKUP_DIR = os.getenv("BACKUP_DIR", "backups")
_KEEP_N = int(os.getenv("BACKUP_KEEP_N", "7"))


def _db_path_from_url(database_url: str) -> str | None:
    """Extract the filesystem path from a sqlite:/// URL."""
    if not database_url.startswith("sqlite:///"):
        return None
    path = database_url[len("sqlite:///"):]
    return path if path else None


def create_backup(
    db_url: str = _DATABASE_URL,
    backup_dir: str = _BACKUP_DIR,
    keep_n: int = _KEEP_N,
) -> dict:
    """Create a timestamped backup of the SQLite database.

    Uses sqlite3.Connection.backup() for an atomic, consistent snapshot even
    while the database is live.  Prunes old backups after writing.

    Returns a dict with ``filename``, ``path``, ``size_bytes``, and
    ``created_at`` (UTC ISO string).
    """
    db_path = _db_path_from_url(db_url)
    if not db_path:
        raise RuntimeError(f"Cannot derive SQLite file path from DATABASE_URL: {db_url!r}")
    if not Path(db_path).exists():
        raise RuntimeError(f"Database file not found: {db_path}")

    backup_dir_path = Path(backup_dir)
    backup_dir_path.mkdir(parents=True, exist_ok=True)

    timestamp = dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"unplugged_{timestamp}.db"
    backup_path = backup_dir_path / backup_filename

    src = sqlite3.connect(db_path)
    dst = sqlite3.connect(str(backup_path))
    try:
        src.backup(dst)
        logger.info("Backup created: %s", backup_path)
    finally:
        dst.close()
        src.close()

    _prune_backups(backup_dir_path, keep_n)

    stat = backup_path.stat()
    return {
        "filename": backup_filename,
        "path": str(backup_path),
        "size_bytes": stat.st_size,
        "created_at": dt.datetime.utcnow().isoformat(),
    }


def list_backups(backup_dir: str = _BACKUP_DIR) -> list[dict]:
    """List available backups in descending creation order."""
    backup_dir_path = Path(backup_dir)
    if not backup_dir_path.exists():
        return []

    files = sorted(backup_dir_path.glob("unplugged_*.db"), reverse=True)
    result = []
    for bp in files:
        stat = bp.stat()
        result.append({
            "filename": bp.name,
            "path": str(bp),
            "size_bytes": stat.st_size,
            "created_at": dt.datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
        })
    return result


def _prune_backups(backup_dir: Path, keep_n: int) -> None:
    """Delete oldest backups, keeping the most recent keep_n files."""
    if keep_n <= 0:
        return
    files = sorted(backup_dir.glob("unplugged_*.db"))  # oldest first
    to_delete = files[:-keep_n] if len(files) > keep_n else []
    for old in to_delete:
        old.unlink(missing_ok=True)
        logger.info("Pruned old backup: %s", old.name)
