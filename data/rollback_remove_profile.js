// File: rollback_remove_profile.js
// Purpose: Remove 'profile' column from audit_logs table in SQLite

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all("PRAGMA table_info(audit_logs)", [], (err, rows) => {
    if (err) {
      console.error("[ROLLBACK ERROR] Failed to inspect audit_logs:", err);
      process.exit(1);
    }

    const hasProfile = rows.some(r => r.name === "profile");
    if (!hasProfile) {
      console.log("✅ 'profile' column does not exist. No rollback needed.");
      process.exit(0);
    }

    console.log("⚙️ Rolling back: removing 'profile' column from audit_logs...");

    db.run("BEGIN TRANSACTION");

    // Create a new table without the profile column
    db.run(`
      CREATE TABLE audit_logs_temp (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT,
        username TEXT,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error("[ROLLBACK ERROR] Failed to create temp table:", err);
        db.run("ROLLBACK");
        process.exit(1);
      }

      // Copy data from old table into temp table (excluding profile)
      db.run(`
        INSERT INTO audit_logs_temp (id, action, username, details, timestamp)
        SELECT id, action, username, details, timestamp FROM audit_logs
      `, (err) => {
        if (err) {
          console.error("[ROLLBACK ERROR] Failed to copy data:", err);
          db.run("ROLLBACK");
          process.exit(1);
        }

        // Drop old table
        db.run("DROP TABLE audit_logs", (err) => {
          if (err) {
            console.error("[ROLLBACK ERROR] Failed to drop old table:", err);
            db.run("ROLLBACK");
            process.exit(1);
          }

          // Rename temp table back to audit_logs
          db.run("ALTER TABLE audit_logs_temp RENAME TO audit_logs", (err) => {
            if (err) {
              console.error("[ROLLBACK ERROR] Failed to rename temp table:", err);
              db.run("ROLLBACK");
              process.exit(1);
            }

            db.run("COMMIT", (err) => {
              if (err) {
                console.error("[ROLLBACK ERROR] Failed to commit transaction:", err);
                process.exit(1);
              }
              console.log("✅ Rollback complete: 'profile' column removed from audit_logs.");
              process.exit(0);
            });
          });
        });
      });
    });
  });
});

