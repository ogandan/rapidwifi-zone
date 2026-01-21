// -----------------------------------------------------------------------------
// Timestamp: 2026-01-21 11:55 WAT
// File: bcrypt_user_insert.js
// Purpose: Generate bcrypt hash for a password and insert/update SQLite users table
// Usage: node bcrypt_user_insert.js <username> <password> <role>
// Example: node bcrypt_user_insert.js admin SRXXX admin
// Path: /home/chairman/rapidwifi-zone/bcrypt_user_insert.js
// -----------------------------------------------------------------------------

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to your SQLite database
const dbPath = path.join(__dirname, 'data', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// Get command-line arguments
const args = process.argv.slice(2);
if (args.length !== 3) {
  console.error('Usage: node bcrypt_user_insert.js <username> <password> <role>');
  process.exit(1);
}

const [username, plainPassword, role] = args;

(async () => {
  try {
    if (!['admin', 'operator'].includes(role)) {
      console.error("Role must be either 'admin' or 'operator'");
      process.exit(1);
    }

    const hash = await bcrypt.hash(plainPassword, 12);

    // Check if user already exists
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) {
        console.error('Error checking user:', err.message);
        db.close();
        return;
      }

      if (row) {
        // Update existing user
        db.run(
          'UPDATE users SET password_hash = ?, role = ? WHERE username = ?',
          [hash, role, username],
          function (err) {
            if (err) {
              console.error('Error updating user:', err.message);
            } else {
              console.log(`🔄 User '${username}' updated with new role '${role}'.`);
            }
            db.close();
          }
        );
      } else {
        // Insert new user
        db.run(
          'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
          [username, hash, role],
          function (err) {
            if (err) {
              console.error('Error inserting user:', err.message);
            } else {
              console.log(`✅ User '${username}' inserted with role '${role}'.`);
            }
            db.close();
          }
        );
      }
    });
  } catch (err) {
    console.error('Error generating hash or inserting/updating user:', err);
    db.close();
  }
})();

