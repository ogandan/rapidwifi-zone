const fs = require('fs');
const path = require('path');

const AUDIT_FILE = path.join(__dirname, '..', 'data', 'audit.log');

/**
 * Append an action entry to the audit log.
 * @param {string} type - Action type (e.g., createBatch, blockVoucher, deleteVoucher).
 * @param {object} details - Additional details about the action.
 */
function logAction(type, details) {
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    details
  };
  try {
    fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = { logAction };

