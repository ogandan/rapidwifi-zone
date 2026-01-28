// -----------------------------------------------------------------------------
// File: modules/voucherManager.js
// Purpose: Manage vouchers (create, list, filter, export)
// -----------------------------------------------------------------------------

const db = require('../data/db');
const { Parser } = require('json2csv');

// --------------------
// Create Voucher
// --------------------
async function createVoucher(username, password, profile, batchTag, createdBy) {
  const sql = `
    INSERT INTO vouchers (username, password, profile, batch_tag, created_by, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `;
  await db.runQuery(sql, [username, password, profile, batchTag, createdBy]);
}

// --------------------
// List All Vouchers
// --------------------
async function listVouchers() {
  return await db.runQuery("SELECT * FROM vouchers ORDER BY id DESC");
}

// --------------------
// List Filtered Vouchers
// --------------------
async function listFiltered({ batch, status, profile }) {
  let sql = "SELECT * FROM vouchers WHERE 1=1";
  const params = [];

  if (batch) {
    sql += " AND batch_tag = ?";
    params.push(batch);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (profile) {
    sql += " AND profile = ?";
    params.push(profile);
  }

  sql += " ORDER BY id DESC";
  return await db.runQuery(sql, params);
}

// --------------------
// Export Vouchers to CSV
// --------------------
async function exportCSV(vouchers) {
  const fields = ['id', 'username', 'password', 'profile', 'batch_tag', 'status', 'created_by'];
  const parser = new Parser({ fields });
  return parser.parse(vouchers);
}

// --------------------
// Module Exports
// --------------------
module.exports = {
  createVoucher,
  listVouchers,
  listFiltered,
  exportCSV
};

