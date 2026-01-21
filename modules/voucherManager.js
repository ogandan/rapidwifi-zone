// -----------------------------------------------------------------------------
// Timestamp: 2026-01-22 00:15 WAT
// File: voucherManager.js
// Purpose: Voucher lifecycle management (validation, creation, listing, deactivation)
// Path: project-root/modules/voucherManager.js
// -----------------------------------------------------------------------------

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', 'data', 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// --------------------
// Helpers
// --------------------
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

// Generate random voucher username (code) and password if not provided
function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A1B2C3"
}
function generatePassword() {
  return crypto.randomBytes(4).toString('hex'); // e.g. "f9a2b3c4"
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
  return voucher.password === password ? voucher : null;
}

// --------------------
// Voucher Listing
// --------------------
async function listVouchers(limit = 100) {
  return await runQuery(
    'SELECT * FROM vouchers ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
}

// --------------------
// Voucher Creation (Admin only)
// --------------------
async function createVoucher(username, password, profile, batchTag = '') {
  // If username/password not provided, auto-generate
  const voucherUser = username || generateCode();
  const voucherPass = password || generatePassword();

  await runExec(
    'INSERT INTO vouchers (username, password, profile, created_at, status, batch_tag) VALUES (?, ?, ?, datetime("now"), "active", ?)',
    [voucherUser, voucherPass, profile, batchTag]
  );

  return { username: voucherUser, password: voucherPass, profile, status: 'active', batch_tag: batchTag };
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

