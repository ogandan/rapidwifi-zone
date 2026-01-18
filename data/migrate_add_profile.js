// File: migrate_add_profile.js
// Purpose: Ensure audit_logs table has a 'profile' column

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to your SQLite database
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all("PRAGMA table_info(audit_logs)", [], (err, rows) => {
    if (err) {
      console.error("[MIGRATION ERROR] Failed to inspect audit_logs:", err);
      process.exit(1);
    }

    const hasProfile = rows.some(r => r.name === "profile");
    if (hasProfile) {
      console.log("✅ 'profile' column already exists in audit_logs. No migration needed.");
      process.exit(0);
    }

    console.log("⚙️ Adding 'profile' column to audit_logs...");
    db.run("ALTER TABLE audit_logs ADD COLUMN profile TEXT", (err) => {
      if (err) {
        console.error("[MIGRATION ERROR] Failed to add profile column:", err);
        process.exit(1);
      } else {
        console.log("✅ Migration complete: 'profile' column added to audit_logs.");
        process.exit(0);
      }
    });
  });
});

