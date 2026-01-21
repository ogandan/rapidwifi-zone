-- -----------------------------------------------------------------------------
-- Timestamp: 2026-01-21 12:30 WAT
-- Migration: Create tunnel table if not exists
-- Purpose: Store Cloudflare tunnel URL for admin dashboard
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tunnel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Insert initial tunnel row (replace with your actual tunnel URL)
-- INSERT INTO tunnel (url) VALUES ('https://your-cloudflare-tunnel-url.trycloudflare.com');
-- -----------------------------------------------------------------------------
-- Timestamp: 2026-01-21 12:30 WAT
-- Migration: Create export_logs table if not exists
-- Purpose: Track voucher/profile export activity for auditability
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS export_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile TEXT NOT NULL,
    filename TEXT NOT NULL,
    exported_by TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Example insert for testing
-- INSERT INTO export_logs (profile, filename, exported_by)
-- VALUES ('premium', 'vouchers_premium.csv', 'admin');

