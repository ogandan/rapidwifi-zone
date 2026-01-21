// -----------------------------------------------------------------------------
// Timestamp: 2026-01-21 11:50 WAT
// File: bcrypt_user_insert.js
// Purpose: Generate bcrypt hash for a password and insert into SQLite users table
// Usage: node bcrypt_user_insert.js <username> <password> <role>
// Example: node bcrypt_user_insert.js admin SRXXX admin
// Path: /home/chairman/rapidwifi-zone/bcrypt_user_insert.js
// node bcrypt_user_insert.js admin SRXXX admin 
// node bcrypt_user_insert.js operator OPYYY operator
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
    // Validate role
    if (!['admin', 'operator'].includes(role)) {
      console.error("Role must be either 'admin' or 'operator'");
      process.exit(1);
    }

    // Generate bcrypt hash
    const hash = await bcrypt.hash(plainPassword, 12);

    // Insert into users table
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
  } catch (err) {
    console.error('Error generating hash or inserting user:', err);
    db.close();
  }
})();

