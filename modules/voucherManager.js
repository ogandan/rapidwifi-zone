// modules/voucherManager.js - voucher lifecycle manager
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../data/db.sqlite');
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

// Validate voucher
async function validateVoucher(username) {
  const rows = await runQuery(
    'SELECT * FROM vouchers WHERE username = ? AND status = "active"',
    [username]
  );
  return rows.length ? rows[0] : null;
}

// Create voucher
async function createVoucher(profile = 'default') {
  const username = `batch-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  await runQuery(
    'INSERT INTO vouchers (username, profile, status) VALUES (?, ?, "active")',
    [username, profile]
  );
  await runQuery(
    'INSERT INTO audit_logs (action, username, profile, details, channel, status) VALUES ("create", ?, ?, "Voucher created", "Dashboard", "success")',
    [username, profile]
  );
  return { username, profile, status: 'active' };
}

// List vouchers
async function listVouchers() {
  return await runQuery('SELECT * FROM vouchers ORDER BY created_at DESC LIMIT 50');
}

// Disable voucher
async function disableVoucher(username) {
  await runQuery('UPDATE vouchers SET status = "disabled" WHERE username = ?', [username]);
  await runQuery(
    'INSERT INTO audit_logs (action, username, details, channel, status) VALUES ("disable", ?, "Voucher disabled", "Dashboard", "success")',
    [username]
  );
  return { username, status: 'disabled' };
}

module.exports = {
  validateVoucher,
  createVoucher,
  listVouchers,
  disableVoucher
};

