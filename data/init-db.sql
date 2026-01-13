-- File: init-db.sql
-- Path: /home/pi/rapidwifi-zone/data/init-db.sql
-- Purpose: Initialize SQLite schema for RAPIDWIFI-ZONE

-- Table: vouchers
CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    profile TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active'
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    username TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: active_users
CREATE TABLE IF NOT EXISTS active_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    login_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

