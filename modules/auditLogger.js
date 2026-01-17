// File: modules/auditLogger.js
// Purpose: Centralized audit logging with JSONL storage and CSV export support

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const LOG_FILE = path.join(DATA_DIR, 'audit.log');

// -----------------------------
// Core Logger
// -----------------------------
function logAction(action, details = {}) {
  const entry = {
    action,
    username: details.username || null,
    profile: details.profile || null,
    details,
    timestamp: new Date().toISOString()
  };

  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('[AUDIT LOGGER ERROR]', err);
  }

  console.log('[AUDIT]', entry);
  return entry;
}

// -----------------------------
// Read all logs
// -----------------------------
function readLogs() {
  if (!fs.existsSync(LOG_FILE)) return [];
  const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// -----------------------------
// Filter logs by criteria
// -----------------------------
function getFilteredAuditLogs({ action, username, from, to, profile }) {
  const logs = readLogs();
  return logs.filter(l => {
    if (action && l.action !== action) return false;
    if (username && l.username !== username) return false;
    if (profile && l.profile !== profile) return false;
    if (from && new Date(l.timestamp) < new Date(from)) return false;
    if (to && new Date(l.timestamp) > new Date(to)) return false;
    return true;
  });
}

// -----------------------------
// Export logs to CSV
// -----------------------------
function exportLogsToCSV(logs) {
  const header = 'Action,Username,Profile,Details,Timestamp\n';
  const body = logs.map(l => {
    const detailsStr = typeof l.details === 'object'
      ? JSON.stringify(l.details).replace(/\n/g, ' ')
      : String(l.details || '');
    return `${l.action},${l.username || ''},${l.profile || ''},${detailsStr},${l.timestamp}`;
  }).join('\n');
  return header + body;
}

// -----------------------------
// Module Exports
// -----------------------------
module.exports = {
  logAction,
  readLogs,
  getFilteredAuditLogs,
  exportLogsToCSV
};

