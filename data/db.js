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
// Analytics Functions
// --------------------

function countAllVouchers() {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) AS total FROM vouchers", [], (err, row) => {
      if (err) return reject(err);
      resolve(row.total);
    });
  });
}

function countActiveVouchers() {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) AS active FROM vouchers WHERE status = 'active'", [], (err, row) => {
      if (err) return reject(err);
      resolve(row.active);
    });
  });
}

function countInactiveVouchers() {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) AS inactive FROM vouchers WHERE status = 'inactive'", [], (err, row) => {
      if (err) return reject(err);
      resolve(row.inactive);
    });
  });
}

function countExportsToday() {
  return new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) AS count FROM download_logs WHERE DATE(timestamp) = DATE('now')", [], (err, row) => {
      if (err) return reject(err);
      resolve(row.count);
    });
  });
}

function countVouchersByProfile() {
  return new Promise((resolve, reject) => {
    db.all("SELECT profile, COUNT(*) AS count FROM vouchers GROUP BY profile", [], (err, rows) => {
      if (err) return reject(err);
      const result = {};
      rows.forEach(r => result[r.profile] = r.count);
      resolve(result);
    });
  });
}

function countExportsByProfile() {
  return new Promise((resolve, reject) => {
    db.all("SELECT profile, COUNT(*) AS count FROM download_logs GROUP BY profile", [], (err, rows) => {
      if (err) return reject(err);
      const result = {};
      rows.forEach(r => result[r.profile] = r.count);
      resolve(result);
    });
  });
}

function voucherCreationOverTime() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT DATE(created_at) AS day, COUNT(*) AS count
       FROM vouchers
       WHERE created_at >= DATE('now', '-6 days')
       GROUP BY day
       ORDER BY day ASC`,
      [],
      (err, rows) => {
        if (err) return reject(err);
        const labels = rows.map(r => r.day);
        const values = rows.map(r => r.count);
        resolve({ labels, values });
      }
    );
  });
}

// --------------------
// Tunnel URL Functions
// --------------------

function getTunnelUrl() {
  try {
    const urlFile = path.join(__dirname, 'tunnel_url.txt');
    if (fs.existsSync(urlFile)) {
      return fs.readFileSync(urlFile, 'utf8').trim();
    }
    return '';
  } catch (err) {
    console.error('Error reading tunnel_url.txt:', err);
    return '';
  }
}

function saveTunnelUrl(url) {
  try {
    const urlFile = path.join(__dirname, 'tunnel_url.txt');
    fs.writeFileSync(urlFile, url, 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing tunnel_url.txt:', err);
    return false;
  }
}

// --------------------
// Download Log Functions
// --------------------

function logDownload(action, filename, user, profile) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    db.run(
      "INSERT INTO download_logs (action, filename, user, profile, timestamp) VALUES (?, ?, ?, ?, ?)",
      [action, filename, user || 'admin', profile || 'unknown', timestamp],
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

// --------------------
// Exports
// --------------------
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
  getTunnelUrl,
  saveTunnelUrl,
  logDownload,
  getDownloadLogs,
  countAllVouchers,
  countActiveVouchers,
  countInactiveVouchers,
  countExportsToday,
  countVouchersByProfile,
  countExportsByProfile,
  voucherCreationOverTime
};

