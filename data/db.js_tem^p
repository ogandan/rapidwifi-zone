// File: db.js
// Path: /home/pi/rapidwifi-zone/data/db.js
// Purpose: SQLite helper functions

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

module.exports = {
  // --- Logging actions ---
  logVoucher: (username, profile) => {
    db.run(
      'INSERT INTO vouchers (username, profile) VALUES (?, ?)',
      [username, profile],
      (err) => {
        if (err) console.error('[DB ERROR] logVoucher:', err);
      }
    );
    db.run(
      'INSERT INTO audit_logs (action, username, profile, details) VALUES (?, ?, ?, ?)',
      ['create', username, profile, `Voucher created with profile ${profile}`],
      (err) => {
        if (err) console.error('[DB ERROR] logVoucher audit:', err);
      }
    );
  },

  logBlock: (username, profile = null) => {
    db.run(
      'UPDATE vouchers SET status = ? WHERE username = ?',
      ['blocked', username],
      (err) => {
        if (err) console.error('[DB ERROR] logBlock:', err);
      }
    );
    db.run(
      'INSERT INTO audit_logs (action, username, profile, details) VALUES (?, ?, ?, ?)',
      ['block', username, profile, 'Voucher blocked'],
      (err) => {
        if (err) console.error('[DB ERROR] logBlock audit:', err);
      }
    );
  },

  logDelete: (username, profile = null) => {
    db.run(
      'DELETE FROM vouchers WHERE username = ?',
      [username],
      (err) => {
        if (err) console.error('[DB ERROR] logDelete:', err);
      }
    );
    db.run(
      'INSERT INTO audit_logs (action, username, profile, details) VALUES (?, ?, ?, ?)',
      ['delete', username, profile, 'Voucher deleted'],
      (err) => {
        if (err) console.error('[DB ERROR] logDelete audit:', err);
      }
    );
  },

  // --- Query helpers for dashboard ---
  getAllVouchers: () => {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM vouchers ORDER BY created_at DESC',
        [],
        (err, rows) => {
          if (err) {
            console.error('[DB ERROR] getAllVouchers:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  },

  getActiveUsers: () => {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM active_users ORDER BY login_time DESC',
        [],
        (err, rows) => {
          if (err) {
            console.error('[DB ERROR] getActiveUsers:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  },

  getAuditLogs: () => {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM audit_logs ORDER BY timestamp DESC',
        [],
        (err, rows) => {
          if (err) {
            console.error('[DB ERROR] getAuditLogs:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  },

  // --- Filtered audit log export ---
  getFilteredAuditLogs: ({ action, username, from, to, profile }) => {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params = [];

      if (action) {
        query += ' AND action = ?';
        params.push(action);
      }
      if (username) {
        query += ' AND username = ?';
        params.push(username);
      }
      if (profile) {
        query += ' AND profile = ?';
        params.push(profile);
      }
      if (from) {
        query += ' AND timestamp >= ?';
        params.push(from);
      }
      if (to) {
        query += ' AND timestamp <= ?';
        params.push(to);
      }

      query += ' ORDER BY timestamp DESC';

      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('[DB ERROR] getFilteredAuditLogs:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
};

