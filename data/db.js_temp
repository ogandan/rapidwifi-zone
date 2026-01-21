// data/db.js - DB utilities for operators, tunnel, logs
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'db.sqlite');
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
// Operator Management
// --------------------

// Create a new operator
async function createOperator(name, role = 'operator') {
  await runExec(
    'INSERT INTO operators (name, role, created_at, active) VALUES (?, ?, datetime("now"), 1)',
    [name, role]
  );
  return { name, role, active: 1 };
}

// List all operators
async function getOperators() {
  return await runQuery('SELECT * FROM operators ORDER BY created_at DESC');
}

// Check if operator has performed actions (audit_logs or payments)
async function operatorHasActions(operatorId) {
  const logs = await runQuery(
    'SELECT COUNT(*) AS count FROM audit_logs WHERE username = (SELECT name FROM operators WHERE id = ?)',
    [operatorId]
  );
  const payments = await runQuery(
    'SELECT COUNT(*) AS count FROM payments WHERE operator = (SELECT name FROM operators WHERE id = ?)',
    [operatorId]
  );
  return (logs[0].count > 0 || payments[0].count > 0);
}

// Delete operator (only if no actions)
async function deleteOperator(operatorId) {
  const hasActions = await operatorHasActions(operatorId);
  if (hasActions) {
    throw new Error('Operator cannot be deleted after performing actions');
  }
  await runExec('DELETE FROM operators WHERE id = ?', [operatorId]);
  return { deleted: true };
}

// --------------------
// Tunnel URL Management
// --------------------
async function saveTunnelUrl(url) {
  await runExec('DELETE FROM tunnel_url');
  await runExec('INSERT INTO tunnel_url (url) VALUES (?)', [url]);
}

async function getTunnelUrl() {
  const rows = await runQuery('SELECT url FROM tunnel_url LIMIT 1');
  return rows.length ? rows[0].url : null;
}

// --------------------
// Logs Management
// --------------------
async function getDownloadLogs(limit = 100) {
  return await runQuery('SELECT * FROM download_logs ORDER BY timestamp DESC LIMIT ?', [limit]);
}

// --------------------
// Analytics Counts
// --------------------
async function countAllVouchers() {
  const rows = await runQuery('SELECT COUNT(*) AS count FROM vouchers');
  return rows[0].count;
}

async function countActiveVouchers() {
  const rows = await runQuery('SELECT COUNT(*) AS count FROM vouchers WHERE status = "active"');
  return rows[0].count;
}

async function countInactiveVouchers() {
  const rows = await runQuery('SELECT COUNT(*) AS count FROM vouchers WHERE status != "active"');
  return rows[0].count;
}

async function countProfiles() {
  const rows = await runQuery('SELECT profile, COUNT(*) AS count FROM vouchers GROUP BY profile');
  return rows;
}

async function countExportsByProfile() {
  const rows = await runQuery('SELECT profile, COUNT(*) AS count FROM download_logs GROUP BY profile');
  return rows;
}

// --------------------
// Exports
// --------------------
module.exports = {
  // Operators
  createOperator,
  getOperators,
  operatorHasActions,
  deleteOperator,

  // Tunnel
  saveTunnelUrl,
  getTunnelUrl,

  // Logs
  getDownloadLogs,

  // Analytics
  countAllVouchers,
  countActiveVouchers,
  countInactiveVouchers,
  countProfiles,
  countExportsByProfile
};

