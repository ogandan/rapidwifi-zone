#!/bin/bash
# File: check_schema.sh
# Purpose: Verify RAPIDWIFI-ZONE SQLite schema for vouchers, users, and export_logs

DB_PATH="/home/chairman/rapidwifi-zone/data/db.sqlite"

echo "=== Checking vouchers table ==="
sqlite3 "$DB_PATH" "PRAGMA table_info(vouchers);"

echo ""
echo "=== Checking users table ==="
sqlite3 "$DB_PATH" "PRAGMA table_info(users);"

echo ""
echo "=== Checking export_logs table ==="
sqlite3 "$DB_PATH" "PRAGMA table_info(export_logs);"

echo ""
echo "=== Sample counts ==="
sqlite3 "$DB_PATH" "SELECT COUNT(*) AS total_vouchers FROM vouchers;"
sqlite3 "$DB_PATH" "SELECT status, COUNT(*) AS count FROM vouchers GROUP BY status;"
sqlite3 "$DB_PATH" "SELECT role, COUNT(*) AS count FROM users GROUP BY role;"
sqlite3 "$DB_PATH" "SELECT profile, COUNT(*) AS count FROM export_logs GROUP BY profile;"

