#!/bin/bash
# File: tools/export_all.sh
# Purpose: regenerate vouchers and audit logs CSV exports

EXPORT_DIR="exports"
DB="data/db.sqlite"

mkdir -p "$EXPORT_DIR"

echo "[INFO] Exporting vouchers..."
sqlite3 -header -csv "$DB" "SELECT * FROM vouchers;" > "$EXPORT_DIR/vouchers_all.csv"

echo "[INFO] Exporting audit logs..."
sqlite3 -header -csv "$DB" "SELECT id, timestamp, action, username, profile, channel, status, details FROM audit_logs;" > "$EXPORT_DIR/audit_logs.csv"

echo "[INFO] Export complete: files written to $EXPORT_DIR/"

