const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbFile = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbFile);

// Utility: generate random string of given length
function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// --------------------
// Voucher Functions
// --------------------

function getVoucherByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM vouchers WHERE username = ?", [username], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function getRecentVouchers(limit = 20) {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM vouchers ORDER BY created_at DESC LIMIT ?", [limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function createVoucher(profile, batchTag) {
  return new Promise((resolve, reject) => {
    const username = randomString(4);
    const password = randomString(5);
    const createdAt = new Date().toISOString();
    const status = 'active';
    const tag = batchTag || `batch_${new Date().toISOString().slice(0,10)}`;

    db.run(
      "INSERT INTO vouchers (username, password, profile, created_at, status, batch_tag) VALUES (?, ?, ?, ?, ?, ?)",
      [username, password, profile, createdAt, status, tag],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, username, password, profile, created_at: createdAt, status, batch_tag: tag });
      }
    );
  });
}

function blockVoucher(id) {
  return new Promise((resolve, reject) => {
    db.run("UPDATE vouchers SET status = 'inactive' WHERE id = ?", [id], function (err) {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

function deleteVoucher(id) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM vouchers WHERE id = ?", [id], function (err) {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

function getAllVouchers() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM vouchers ORDER BY created_at DESC", [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function getVouchersByDateRange(startDate, endDate) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM vouchers WHERE date(created_at) BETWEEN date(?) AND date(?) ORDER BY created_at DESC",
      [startDate, endDate],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

function getVouchersByProfile(profile) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM vouchers WHERE profile = ? ORDER BY created_at DESC",
      [profile],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

function getVouchersByBatch(batchTag) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM vouchers WHERE batch_tag = ? ORDER BY created_at DESC",
      [batchTag],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

// --------------------
// Download Log Functions
// --------------------

function logDownload(action, filename, user) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    db.run(
      "INSERT INTO download_logs (action, filename, user, timestamp) VALUES (?, ?, ?, ?)",
      [action, filename, user || 'admin', timestamp],
      function (err) {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

function getDownloadLogs(limit = 50) {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM download_logs ORDER BY timestamp DESC LIMIT ?", [limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

module.exports = {
  getVoucherByUsername,
  getRecentVouchers,
  createVoucher,
  blockVoucher,
  deleteVoucher,
  getAllVouchers,
  getVouchersByDateRange,
  getVouchersByProfile,
  getVouchersByBatch,
  logDownload,
  getDownloadLogs,
  getTunnelUrl,
  saveTunnelUrl
};

