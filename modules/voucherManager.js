// File: modules/voucherManager.js
// Purpose: Voucher lifecycle manager with TEST_MODE simulation, RouterOS SSH support, audit logging, and optional email distribution

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client: SSHClient } = require('ssh2');
const nodemailer = require('nodemailer');
const { logAction } = require('./auditLogger');

const TEST_MODE = process.env.TEST_MODE === 'true';
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const EMAIL_ENABLED = (process.env.EMAIL_ENABLED || 'false') === 'true';
let transporter = null;
if (EMAIL_ENABLED) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: (process.env.EMAIL_SECURE || 'false') === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

let simulatedUsers = [];

const USERNAME_LEN = parseInt(process.env.VOUCHER_USER_LEN || '4', 10);
const PASSWORD_LEN = parseInt(process.env.VOUCHER_PASS_LEN || '5', 10);

function randomPassword(length = PASSWORD_LEN) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function sanitize(str) {
  return String(str).replace(/[^\w.\-:@]/g, '_');
}

// … (ros, parseUsersPrint, addUser, fetchUsers, blockVoucher, deleteVoucher unchanged)

async function createBatch(count, profile, batch) {
  let tag = batch && batch.trim() ? sanitize(batch) : (() => {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    return `batch-${timestamp}`;
  })();

  const created = [];
  for (let i = 0; i < Number(count || 1); i++) {
    const suffix = crypto.randomBytes(2).toString('hex').slice(0, USERNAME_LEN);
    const username = `${tag}-${suffix}-${i}`;
    const password = randomPassword(PASSWORD_LEN);
    await addUser(username, password, profile, tag);
    created.push({ name: username, password, profile, comment: tag, status: 'active' });
  }

  const lines = created.map(v => `${v.name},${v.password},${v.profile},${v.comment}`);
  await sendEmail(`Vouchers created: ${created.length}`, lines.join('\n'));
  logAction('createBatch', { count: Number(count || 1), profile, batch: tag });
  return created;
}

// ✅ New wrapper for CI/CD script
async function createVouchers(profile, count) {
  return createBatch(count, profile);
}

// … (exportBatch, exportAll, exportProfiles, getStats, revokeBatch unchanged)

module.exports = {
  // Core
  createBatch,
  createVouchers,   // <-- new export
  addUser,
  fetchUsers,
  blockVoucher,
  deleteVoucher,
  userExists,

  // Export & Stats
  exportBatch,
  exportAll,
  exportProfiles,
  getStats,

  // Optional lifecycle
  revokeBatch
};

