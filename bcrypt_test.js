// -----------------------------------------------------------------------------
// Timestamp: 2026-01-21 11:45 WAT
// File: bcrypt_test.js
// Purpose: Generate bcrypt hash for a password and insert into SQLite users table
// Path: /home/chairman/rapidwifi-zone/bcrypt_test.js
// -----------------------------------------------------------------------------

const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to your SQLite database
const dbPath = path.join(__dirname, 'data', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

(async () => {
  try {
    // Replace these with desired credentials
    const username = 'admin';
    const plainPassword = 'SRXXX'; // password to hash
    const role = 'admin'; // 'admin' or 'operator'

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
          console.log(`User '${username}' inserted with role '${role}'.`);
        }
        db.close();
      }
    );
  } catch (err) {
    console.error('Error generating hash or inserting user:', err);
    db.close();
  }
})();

