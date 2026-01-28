// -----------------------------------------------------------------------------
// Timestamp: 2026-01-28 19:26 WAT
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
  const creator = createdBy && createdBy.trim() !== '' ? createdBy : 'system';

  await db.runQuery(
    "INSERT INTO vouchers (username, password, profile, created_at, status, batch_tag, created_by) VALUES (?, ?, ?, datetime('now'), 'active', ?, ?)",
    [u, p, profile, tag, creator]
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
// List Filtered Vouchers
// --------------------
async function listFiltered(filters) {
  const conditions = [];
  const params = [];

  if (filters.batch) {
    conditions.push("batch_tag = ?");
    params.push(filters.batch);
  }
  if (filters.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  if (filters.profile) {
    conditions.push("profile = ?");
    params.push(filters.profile);
  }

  const whereClause = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  return db.runQuery(`SELECT * FROM vouchers ${whereClause} ORDER BY created_at DESC`, params);
}

// --------------------
// Export CSV
// --------------------
async function exportCSV(vouchers) {
  const header = "id,username,password,profile,status,batch_tag,created_by,created_at\n";
  const rows = vouchers.map(v =>
    `${v.id},${v.username},${v.password},${v.profile},${v.status},${v.batch_tag},${v.created_by || ''},${v.created_at}`
  );
  return header + rows.join("\n");
}

// --------------------
// Exports
// --------------------
module.exports = {
  createVoucher,
  validateVoucher,
  listVouchers,
  listFiltered,
  exportCSV
};

