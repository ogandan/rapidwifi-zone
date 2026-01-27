// -----------------------------------------------------------------------------
// Timestamp: 2026-01-27 20:30 WAT
// File: modules/voucherManager.js
// Purpose: Voucher lifecycle management for RAPIDWIFI-ZONE
// -----------------------------------------------------------------------------

const db = require('../data/db');

// --------------------
// Utility: Random String Generator
// --------------------
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// --------------------
// Create Voucher
// --------------------
async function createVoucher(username, password, profile, batchTag, createdBy) {
  // enforce username = 4 chars, password = 5 chars
  const u = username && username.trim() !== '' ? username : generateRandomString(4);
  const p = password && password.trim() !== '' ? password : generateRandomString(5);

  if (u.length !== 4) {
    throw new Error('Voucher username must be exactly 4 characters long');
  }
  if (p.length !== 5) {
    throw new Error('Voucher password must be exactly 5 characters long');
  }

  const tag = batchTag && batchTag.trim() !== '' ? batchTag : `batch_${new Date().toISOString().slice(0, 10)}`;

  await db.runQuery(
    "INSERT INTO vouchers (username, password, profile, created_at, status, batch_tag, created_by) VALUES (?, ?, ?, datetime('now'), 'active', ?, ?)",
    [u, p, profile, tag, createdBy]
  );
}

// --------------------
// Validate Voucher
// --------------------
async function validateVoucher(username, password) {
  const rows = await db.runQuery(
    "SELECT * FROM vouchers WHERE username = ? AND password = ? AND status = 'active'",
    [username, password]
  );
  return rows.length > 0 ? rows[0] : null;
}

// --------------------
// List Vouchers
// --------------------
async function listVouchers() {
  return db.runQuery("SELECT * FROM vouchers ORDER BY created_at DESC");
}

// --------------------
// Exports
// --------------------
module.exports = {
  createVoucher,
  validateVoucher,
  listVouchers
};

