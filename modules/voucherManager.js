// -----------------------------------------------------------------------------
// Timestamp: 2026-01-21 09:30 WAT
// File: voucherManager.js
// Purpose: Voucher lifecycle management (validation, creation, delivery, audit)
// Path: project-root/voucherManager.js
// -----------------------------------------------------------------------------

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname, 'data', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// Helper: run query with Promise
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runExec(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// --------------------
// Voucher Validation
// --------------------
async function validateVoucher(username, password) {
  const rows = await runQuery(
    'SELECT * FROM vouchers WHERE username = ? AND status = "active"',
    [username]
  );

  if (!rows.length) return null;

  const voucher = rows[0];

  // Compare provided password with stored password
  if (voucher.password === password) {
    return voucher;
  } else {
    return null;
  }
}
// --------------------
// Voucher Listing
// --------------------
async function listVouchers(limit = 100) {
  return await runQuery(
    'SELECT * FROM vouchers ORDER BY createdAt DESC LIMIT ?',
    [limit]
  );
}

// --------------------
// Voucher Creation (Admin only)
// --------------------
async function createVoucher(username, password, profile) {
  await runExec(
    'INSERT INTO vouchers (username, password, profile, createdAt, status) VALUES (?, ?, ?, datetime("now"), "active")',
    [username, password, profile]
  );
  return { username, profile, status: 'active' };
}

// --------------------
// Voucher Deactivation
// --------------------
async function deactivateVoucher(username) {
  await runExec(
    'UPDATE vouchers SET status = "inactive" WHERE username = ?',
    [username]
  );
  return { username, status: 'inactive' };
}

// --------------------
// Exports
// --------------------
module.exports = {
  validateVoucher,
  listVouchers,
  createVoucher,
  deactivateVoucher
};

