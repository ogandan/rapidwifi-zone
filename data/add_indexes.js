// File: add_indexes.js
// Purpose: Ensure useful indexes exist on audit_logs for faster filtering

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Adjust path if needed; here it assumes this script is in /home/chairman/rapidwifi-zone/data/
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

const indexes = [
  { name: 'idx_audit_action', sql: 'CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)' },
  { name: 'idx_audit_username', sql: 'CREATE INDEX IF NOT EXISTS idx_audit_username ON audit_logs(username)' },
  { name: 'idx_audit_profile', sql: 'CREATE INDEX IF NOT EXISTS idx_audit_profile ON audit_logs(profile)' },
  { name: 'idx_audit_timestamp', sql: 'CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)' }
];

db.serialize(() => {
  indexes.forEach(idx => {
    db.run(idx.sql, (err) => {
      if (err) {
        console.error(`[MIGRATION ERROR] Failed to create index ${idx.name}:`, err);
      } else {
        console.log(`✅ Index ensured: ${idx.name}`);
      }
    });
  });
});

db.close((err) => {
  if (err) {
    console.error("[MIGRATION ERROR] Failed to close database:", err);
  } else {
    console.log("✅ Migration complete: all indexes checked/created.");
  }
});

