-- ============================================
-- RAPIDWIFI-ZONE Migration Script
-- Date: 20 Jan 2026
-- Purpose: Add operators table, rebuild payments and delivery_logs with foreign keys
-- ============================================

-- Step 0: Safety check - enable foreign keys
PRAGMA foreign_keys = ON;

-- Step 1: Create missing operators table
CREATE TABLE IF NOT EXISTS operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',   -- 'operator' or 'admin'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    active INTEGER DEFAULT 1                 -- 1 = active, 0 = disabled
);

-- Step 2: Rename old tables
ALTER TABLE payments RENAME TO payments_old;
ALTER TABLE delivery_logs RENAME TO delivery_logs_old;

-- Step 3: Create new tables with foreign keys
CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT NOT NULL,              -- Client username or voucher reference
    provider TEXT NOT NULL,          -- 'MTN', 'Moov', 'Cash'
    amount REAL NOT NULL,
    status TEXT NOT NULL,            -- 'pending', 'success', 'failed'
    operator TEXT,                   -- Operator handling cash
    voucher_id TEXT,                 -- Link to voucher
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(username)
);

CREATE TABLE delivery_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id TEXT NOT NULL,        -- Voucher username or ID
    channel TEXT NOT NULL,           -- 'SMS', 'WhatsApp', 'Telegram'
    recipient TEXT NOT NULL,         -- Phone number or chat ID
    status TEXT NOT NULL,            -- 'sent', 'failed'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(username)
);

-- Step 4: Copy data from old tables to new
INSERT INTO payments (id, user, provider, amount, status, operator, voucher_id, timestamp)
SELECT id, user, provider, amount, status, operator, voucher_id, timestamp
FROM payments_old;

INSERT INTO delivery_logs (id, voucher_id, channel, recipient, status, timestamp)
SELECT id, voucher_id, channel, recipient, status, timestamp
FROM delivery_logs_old;

-- Step 5: Drop old tables
DROP TABLE payments_old;
DROP TABLE delivery_logs_old;

-- ============================================
-- End of Migration Script
-- ============================================

