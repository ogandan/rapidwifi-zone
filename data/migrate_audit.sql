-- 1. Create a new table with the correct schema
CREATE TABLE audit_logs_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    username TEXT,
    profile TEXT,
    details TEXT,
    channel TEXT,
    status TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Copy existing data into the new table
INSERT INTO audit_logs_new (action, username, profile, details, channel, status, timestamp)
SELECT action, username, profile, details, channel, status, timestamp
FROM audit_logs;

-- 3. Drop the old table
DROP TABLE audit_logs;

-- 4. Rename the new table
ALTER TABLE audit_logs_new RENAME TO audit_logs;

-- 5. Recreate indexes
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_username ON audit_logs(username);
CREATE INDEX idx_audit_profile ON audit_logs(profile);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);

