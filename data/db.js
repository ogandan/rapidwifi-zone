// -----------------------------------------------------------------------------
// Timestamp: 2026-01-21 12:00 WAT
// File: db.js
// Purpose: Centralized SQLite database helpers and query functions for RAPIDWIFI-ZONE
// Path: /home/chairman/rapidwifi-zone/data/db.js
// -----------------------------------------------------------------------------

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Database path
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// --------------------
// Generic Helpers
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

// --------------------
// Specific Queries
// --------------------
async function getOperators() {
  return await runQuery('SELECT * FROM users WHERE role = "operator"');
}

async function getTunnelUrl() {
  const rows = await runQuery('SELECT * FROM tunnel LIMIT 1');
  return rows.length ? rows[0].url : null;
}

async function countAllVouchers() {
  const rows = await runQuery('SELECT COUNT(*) AS total FROM vouchers');
  return rows[0].total;
}

async function countActiveVouchers() {
  const rows = await runQuery('SELECT COUNT(*) AS active FROM vouchers WHERE status = "active"');
  return rows[0].active;
}

async function countInactiveVouchers() {
  const rows = await runQuery('SELECT COUNT(*) AS inactive FROM vouchers WHERE status = "inactive"');
  return rows[0].inactive;
}

async function countProfiles() {
  const rows = await runQuery('SELECT profile, COUNT(*) AS count FROM vouchers GROUP BY profile');
  return rows;
}

async function countExportsByProfile() {
  const rows = await runQuery('SELECT profile, COUNT(*) AS exports FROM export_logs GROUP BY profile');
  return rows;
}

async function getDownloadLogs() {
  return await runQuery('SELECT * FROM download_logs ORDER BY timestamp DESC');
}

// --------------------
// Exports
// --------------------
module.exports = {
  runQuery,
  runExec,
  getOperators,
  getTunnelUrl,
  countAllVouchers,
  countActiveVouchers,
  countInactiveVouchers,
  countProfiles,
  countExportsByProfile,
  getDownloadLogs
};

