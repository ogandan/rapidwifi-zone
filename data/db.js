// -----------------------------------------------------------------------------
// File: data/db.js
// Purpose: Database helper functions for RAPIDWIFI-ZONE
// -----------------------------------------------------------------------------

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'db.sqlite'));

// --------------------
// Utility: Run Query
// --------------------
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// --------------------
// Voucher Functions
// --------------------
async function listVouchers() {
  return await runQuery('SELECT * FROM vouchers ORDER BY id DESC');
}

async function countAllVouchers() {
  const rows = await runQuery('SELECT COUNT(*) AS total FROM vouchers');
  return rows[0].total;
}

async function countActiveVouchers() {
  const rows = await runQuery("SELECT COUNT(*) AS active FROM vouchers WHERE status='active'");
  return rows[0].active;
}

async function countInactiveVouchers() {
  const rows = await runQuery("SELECT COUNT(*) AS inactive FROM vouchers WHERE status='inactive'");
  return rows[0].inactive;
}

async function countProfiles() {
  return await runQuery('SELECT profile, COUNT(*) AS count FROM vouchers GROUP BY profile');
}

async function countExportsByProfile() {
  return await runQuery('SELECT profile, COUNT(*) AS count FROM export_logs GROUP BY profile');
}

// --------------------
// Operator Functions
// --------------------
async function getOperators() {
  return await runQuery('SELECT id, username, role, status FROM users WHERE role="operator"');
}

async function deactivateOperator(id) {
  return await runQuery("UPDATE users SET status='inactive' WHERE id=?", [id]);
}

async function activateOperator(id) {
  return await runQuery("UPDATE users SET status='active' WHERE id=?", [id]);
}

async function deleteOperator(id) {
  return await runQuery("DELETE FROM users WHERE id=? AND role='operator'", [id]);
}

async function operatorHasActions(id) {
  const rows = await runQuery('SELECT COUNT(*) AS cnt FROM export_logs WHERE exported_by=?', [id]);
  return rows[0].cnt > 0;
}

// --------------------
// Export Logs Functions
// --------------------
async function getLogs(limit = 100) {
  return await runQuery('SELECT * FROM export_logs ORDER BY timestamp DESC LIMIT ?', [limit]);
}

// --------------------
// Payments Functions
// --------------------
async function getPayments(limit = 100) {
  return await runQuery(
    'SELECT id, voucher_id, method, amount, status, timestamp FROM payments ORDER BY timestamp DESC LIMIT ?',
    [limit]
  );
}

// Payments grouped by date (daily counts)
async function getPaymentsByDate() {
  return await runQuery(`
    SELECT DATE(timestamp) AS date, COUNT(*) AS count
    FROM payments
    GROUP BY DATE(timestamp)
    ORDER BY DATE(timestamp)
  `);
}

// Revenue trend (cumulative over time)
async function getRevenueTrend() {
  return await runQuery(`
    SELECT DATE(timestamp) AS date, SUM(amount) AS total
    FROM payments
    WHERE status='success'
    GROUP BY DATE(timestamp)
    ORDER BY DATE(timestamp)
  `);
}

// Revenue grouped by voucher profile
async function getProfileRevenue() {
  return await runQuery(`
    SELECT v.profile AS profile, SUM(p.amount) AS total
    FROM payments p
    JOIN vouchers v ON p.voucher_id = v.id
    WHERE p.status='success'
    GROUP BY v.profile
    ORDER BY total DESC
  `);
}

// --------------------
// Audit Logs Functions
// --------------------
async function getAuditLogs(limit = 100) {
  return await runQuery(
    'SELECT id, voucher_id, action, username, profile, details, channel, status, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT ?',
    [limit]
  );
}

// --------------------
// Module Exports
// --------------------
module.exports = {
  runQuery,

  // Voucher
  listVouchers,
  countAllVouchers,
  countActiveVouchers,
  countInactiveVouchers,
  countProfiles,
  countExportsByProfile,

  // Operator
  getOperators,
  deactivateOperator,
  activateOperator,
  deleteOperator,
  operatorHasActions,

  // Logs
  getLogs,

  // Payments
  getPayments,
  getPaymentsByDate,
  getRevenueTrend,
  getProfileRevenue,

  // Audit Logs
  getAuditLogs
};

