#!/bin/bash
# Unplugged — SQLite backup script
# Run via cron: 0 3 * * * /path/to/backup.sh
set -e

BACKUP_DIR="${BACKUP_DIR:-/mnt/usb/unplugged-backups}"
DB_VOLUME="my_ai_mentor_db_data"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/unplugged_$TIMESTAMP.db"
MAX_BACKUPS=30

echo "💾 Starting Unplugged backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Checkpoint WAL to ensure consistency
docker compose exec api python -c "
import sqlite3
conn = sqlite3.connect('/app/data/unplugged.db')
conn.execute('PRAGMA wal_checkpoint(TRUNCATE)')
conn.close()
print('WAL checkpoint complete')
"

# Copy database from Docker volume
docker cp "$(docker compose ps -q api):/app/data/unplugged.db" "$BACKUP_FILE"

echo "✅ Backup saved: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Rotate old backups (keep last N)
cd "$BACKUP_DIR"
ls -t unplugged_*.db | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm --
echo "🔄 Kept last $MAX_BACKUPS backups"

echo "💾 Backup complete!"
