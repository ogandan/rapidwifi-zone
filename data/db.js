// -----------------------------------------------------------------------------
// Timestamp: 2026-01-21 22:50 WAT
// File: data/db.js
// Purpose: SQLite database helpers for RAPIDWIFI-ZONE
// Path: /home/chairman/rapidwifi-zone/data/db.js
// -----------------------------------------------------------------------------

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// --------------------
// Generic Helpers
// --------------------
function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// --------------------
// Voucher Queries
// --------------------
async function getOperators() {
  return runQuery('SELECT username, role FROM users WHERE role = "operator"');
}

async function getTunnelUrl() {
  const row = await runGet('SELECT url FROM tunnel LIMIT 1');
  return row ? row.url : null;
}

async function countAllVouchers() {
  const row = await runGet('SELECT COUNT(*) AS total FROM vouchers');
  return row ? row.total : 0;
}

async function countActiveVouchers() {
  const row = await runGet('SELECT COUNT(*) AS active FROM vouchers WHERE status = "active"');
  return row ? row.active : 0;
}

async function countInactiveVouchers() {
  const row = await runGet('SELECT COUNT(*) AS inactive FROM vouchers WHERE status = "inactive"');
  return row ? row.inactive : 0;
}

async function countProfiles() {
  return runQuery('SELECT profile, COUNT(*) AS count FROM vouchers GROUP BY profile');
}

async function countExportsByProfile() {
  return runQuery('SELECT profile, COUNT(*) AS count FROM export_logs GROUP BY profile');
}

async function getDownloadLogs() {
  return runQuery('SELECT * FROM export_logs ORDER BY timestamp DESC');
}

// --------------------
// Exports
// --------------------
module.exports = {
  runQuery,
  runGet,
  getOperators,
  getTunnelUrl,
  countAllVouchers,
  countActiveVouchers,
  countInactiveVouchers,
  countProfiles,
  countExportsByProfile,
  getDownloadLogs
};

