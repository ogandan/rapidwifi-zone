// -----------------------------------------------------------------------------
// Timestamp: 2026-01-23 10:50 WAT
// File: data/db.js (Part 1 of 2)
// Purpose: Database helpers for RAPIDWIFI-ZONE with role+status separation
// -----------------------------------------------------------------------------

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/rapidwifi.db');

// Generic query runner
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// --------------------
// Operator Lifecycle
// --------------------

// Get all operators (include status)
async function getOperators() {
  return runQuery("SELECT id, username, role, status FROM users WHERE role='operator'");
}

// Deactivate operator (set status=inactive)
async function deactivateOperator(id) {
  return runQuery("UPDATE users SET status='inactive' WHERE id=?", [id]);
}

// Activate operator (set status=active)
async function activateOperator(id) {
  return runQuery("UPDATE users SET status='active' WHERE id=?", [id]);
}

// Delete operator (only if no actions)
async function deleteOperator(id) {
  return runQuery("DELETE FROM users WHERE id=?", [id]);
}

// Check if operator has actions (logs, vouchers, etc.)
async function operatorHasActions(id) {
  const rows = await runQuery("SELECT COUNT(*) as cnt FROM logs WHERE operator_id=?", [id]);
  return rows[0].cnt > 0;
}
// -----------------------------------------------------------------------------
// data/db.js (Part 2 of 2)
// -----------------------------------------------------------------------------

// --------------------
// Voucher Lifecycle
// --------------------
async function getVouchers() {
  return runQuery("SELECT * FROM vouchers ORDER BY created_at DESC");
}

async function blockVoucher(id) {
  return runQuery("UPDATE vouchers SET status='inactive' WHERE id=?", [id]);
}

async function activateVoucher(id) {
  return runQuery("UPDATE vouchers SET status='active' WHERE id=?", [id]);
}

async function deleteVoucher(id) {
  return runQuery("DELETE FROM vouchers WHERE id=?", [id]);
}

// --------------------
// Analytics
// --------------------
async function getVoucherCounts() {
  return runQuery(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status='inactive' THEN 1 ELSE 0 END) as inactive
    FROM vouchers
  `);
}

async function getProfileCounts() {
  return runQuery("SELECT profile, COUNT(*) as cnt FROM vouchers GROUP BY profile");
}

// --------------------
// Logs
// --------------------
async function getLogs() {
  return runQuery("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100");
}

module.exports = {
  runQuery,
  getOperators,
  deactivateOperator,
  activateOperator,
  deleteOperator,
  operatorHasActions,
  getVouchers,
  blockVoucher,
  activateVoucher,
  deleteVoucher,
  getVoucherCounts,
  getProfileCounts,
  getLogs
};

