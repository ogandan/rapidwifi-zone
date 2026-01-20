// db.js — Final Corrected Version
// Timestamp: 20 Jan 2026 — 15:35 WAT
// Features: voucher, operator, analytics, tunnel, logs, hasActions

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
// Operator Functions
// --------------------
function getOperators() {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, username, role FROM users WHERE role = 'operator'", [], async (err, rows) => {
      if (err) return reject(err);

      try {
        const enriched = await Promise.all(rows.map(op => {
          return new Promise((res, rej) => {
            db.get(
              "SELECT COUNT(*) AS count FROM download_logs WHERE user = ?",
              [op.username],
              (err2, row) => {
                if (err2) return rej(err2);
                op.hasActions = row.count > 0;
                res(op);
              }
            );
          });
        }));
        resolve(enriched);
      } catch (e) {
        reject(e);
      }
    });
  });
}

function getOperatorByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function createOperator(username, passwordHash) {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'operator')",
      [username, passwordHash],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, username, role: 'operator' });
      }
    );
  });
}

function deleteOperator(id) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM users WHERE id = ?", [id], function (err) {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

function operatorHasActions(id) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT COUNT(*) AS count FROM download_logs WHERE user = (SELECT username FROM users WHERE id = ?)",
      [id],
      (err, row) => {
        if (err) return reject(err);
        resolve(row.count > 0);
      }
    );
  });
}
// ===== db.js Part 2 =====
// Timestamp: 20 Jan 2026 — 15:40 WAT
// Features: analytics, tunnel, logs, exports

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

function voucherCreationDaily() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT DATE(created_at) AS day, COUNT(*) AS count
       FROM vouchers
       GROUP BY day
       ORDER BY day ASC`,
      [],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

function voucherCreationWeekly() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT strftime('%Y-%W', created_at) AS week, COUNT(*) AS count
       FROM vouchers
       GROUP BY week
       ORDER BY week ASC`,
      [],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

function profilePerformance() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT v.profile,
              COUNT(v.id) AS vouchers,
              COALESCE(e.exports, 0) AS exports
       FROM vouchers v
       LEFT JOIN (
         SELECT profile, COUNT(*) AS exports
         FROM download_logs
         GROUP BY profile
       ) e ON v.profile = e.profile
       GROUP BY v.profile`,
      [],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

function exportBehaviorInsights() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT user AS admin_user,
              profile,
              DATE(timestamp) AS day,
              COUNT(*) AS exports
       FROM download_logs
       GROUP BY admin_user, profile, day
       ORDER BY day DESC`,
      [],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
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
  // Voucher functions
  getVoucherByUsername,
  getRecentVouchers,
  createVoucher,
  blockVoucher,
  deleteVoucher,
  getAllVouchers,
  getVouchersByDateRange,
  getVouchersByProfile,
  getVouchersByBatch,

  // Operator functions
  getOperators,
  getOperatorByUsername,
  createOperator,
  deleteOperator,
  operatorHasActions,

  // Analytics functions
  countAllVouchers,
  countActiveVouchers,
  countInactiveVouchers,
  countExportsToday,
  countVouchersByProfile,
  countExportsByProfile,
  voucherCreationOverTime,
  voucherCreationDaily,
  voucherCreationWeekly,
  profilePerformance,
  exportBehaviorInsights,

  // Tunnel functions
  getTunnelUrl,
  saveTunnelUrl,

  // Log functions
  logDownload,
  getDownloadLogs
};

