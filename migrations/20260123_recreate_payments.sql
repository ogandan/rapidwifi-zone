-- -----------------------------------------------------------------------------
-- Migration: Drop old payments table and recreate with normalized schema
-- Timestamp: 2026-01-23 22:45 WAT
-- -----------------------------------------------------------------------------

BEGIN TRANSACTION;

-- 1. Drop existing payments table (empty, safe to remove)
DROP TABLE IF EXISTS payments;

-- 2. Create normalized payments table
CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL,          -- FK → vouchers.id
    user_id INTEGER,                      -- FK → users.id (operator/admin who processed, NULL for mobile money)
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'XOF',
    method TEXT NOT NULL,                 -- 'mobile_money', 'cash', 'card'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    transaction_ref TEXT,                 -- external gateway reference
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_voucher_id ON payments(voucher_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

COMMIT;

