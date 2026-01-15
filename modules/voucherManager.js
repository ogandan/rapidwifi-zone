// File: modules/voucherManager.js
// Purpose: Voucher lifecycle manager with TEST_MODE simulation, RouterOS SSH support, audit logging, and optional email distribution

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client: SSHClient } = require('ssh2');
const nodemailer = require('nodemailer');
const { logAction } = require('./auditLogger');

// -----------------------------
// Config & Flags
// -----------------------------
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

// In-memory store for TEST_MODE simulation
let simulatedUsers = [];

// -----------------------------
// Configurable lengths
// -----------------------------
const USERNAME_LEN = parseInt(process.env.VOUCHER_USER_LEN || '4', 10);
const PASSWORD_LEN = parseInt(process.env.VOUCHER_PASS_LEN || '5', 10);

// -----------------------------
// Utilities
// -----------------------------
function randomPassword(length = PASSWORD_LEN) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function sanitize(str) {
  return String(str).replace(/[^\w.\-:@]/g, '_');
}

function writeCSV(filePath, rows, header) {
  const content = [header, ...rows].join('\n');
  fs.writeFileSync(filePath, content);
  return filePath;
}

async function sendEmail(subject, text) {
  if (!EMAIL_ENABLED || !transporter) return false;
  const to = process.env.EMAIL_TO || process.env.EMAIL_USER;
  try {
    await transporter.sendMail({ from: process.env.EMAIL_FROM || process.env.EMAIL_USER, to, subject, text });
    logAction('emailBatch', { subject, to });
    return true;
  } catch (err) {
    console.warn('[VoucherManager] Email send failed:', err.message);
    return false;
  }
}

// -----------------------------
// RouterOS command runner
// -----------------------------
async function ros(cmd) {
  if (TEST_MODE) {
    console.log(`[VoucherManager] TEST MODE: would run -> ${cmd}`);

    if (cmd.startsWith('/ip hotspot user add')) {
      const match = cmd.match(/name=(\S+)\s+password=(\S+)\s+profile=(\S+)\s+comment=(\S+)/);
      if (match) {
        const [, name, password, profile, comment] = match;
        if (!simulatedUsers.find(u => u.name === name)) {
          simulatedUsers.push({ name, password, profile, comment, status: 'active' });
        }
      }
      return '';
    }

    if (cmd.startsWith('/ip hotspot user print')) {
      return simulatedUsers.map((u, i) =>
        `${i} name="${u.name}" password="${u.password}" profile="${u.profile}" comment="${u.comment}" disabled=${u.status === 'blocked' ? 'yes' : 'no'}`
      ).join('\n');
    }

    if (cmd.includes('disabled=yes')) {
      const match = cmd.match(/find name=([^\]\s]+)/);
      const username = match?.[1];
      const user = simulatedUsers.find(u => u.name === username);
      if (user) user.status = 'blocked';
      return '';
    }

    if (cmd.includes('remove')) {
      const match = cmd.match(/find name=([^\]\s]+)/);
      const username = match?.[1];
      simulatedUsers = simulatedUsers.filter(u => u.name !== username);
      return '';
    }

    return '';
  }

  // Real SSH execution
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    const connOpts = {
      host: process.env.ROS_HOST || '192.168.88.1',
      port: parseInt(process.env.ROS_PORT || '22', 10),
      username: process.env.ROS_USER || 'admin',
      readyTimeout: parseInt(process.env.ROS_READY_TIMEOUT || '10000', 10)
    };

    if (process.env.ROS_KEY_PATH && fs.existsSync(process.env.ROS_KEY_PATH)) {
      connOpts.privateKey = fs.readFileSync(process.env.ROS_KEY_PATH);
      if (process.env.ROS_KEY_PASSPHRASE) connOpts.passphrase = process.env.ROS_KEY_PASSPHRASE;
    } else if (process.env.ROS_PASS) {
      connOpts.password = process.env.ROS_PASS;
    }

    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        let stdout = '';
        let stderr = '';
        stream.on('close', () => {
          conn.end();
          if (stderr) return reject(new Error(stderr));
          resolve(stdout.trim());
        }).on('data', (data) => { stdout += data.toString(); })
          .stderr.on('data', (data) => { stderr += data.toString(); });
      });
    }).on('error', (err) => reject(err)).connect(connOpts);
  });
}
// -----------------------------
// Parsing Helpers
// -----------------------------
function parseUsersPrint(output) {
  const users = [];
  const lines = output.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (!/name=/.test(line)) continue;
    const m = {
      name: (line.match(/name="([^"]+)"/) || [,''])[1],
      password: (line.match(/password="([^"]+)"/) || [,''])[1],
      profile: (line.match(/profile="([^"]+)"/) || [,''])[1],
      comment: (line.match(/comment="([^"]+)"/) || [,''])[1],
      disabled: (line.match(/disabled=(yes|no)/) || [,'no'])[1]
    };
    if (m.name) {
      users.push({
        name: m.name,
        password: m.password || '',
        profile: m.profile || 'default',
        comment: m.comment || '',
        status: m.disabled === 'yes' ? 'blocked' : 'active'
      });
    }
  }
  return users;
}

// -----------------------------
// Core Voucher Operations
// -----------------------------
async function userExists(username) {
  const out = await ros(`/ip hotspot user print where name=${sanitize(username)}`);
  return out.includes(`name="${username}"`);
}

async function addUser(username, password, profile, batch) {
  const result = await ros(`/ip hotspot user add name=${sanitize(username)} password=${sanitize(password)} profile=${sanitize(profile)} comment=${sanitize(batch)}`);
  logAction('addUser', { username, profile, batch });
  return result;
}

async function fetchUsers() {
  const out = await ros('/ip hotspot user print detail');
  return parseUsersPrint(out);
}

async function blockVoucher(username) {
  const result = await ros(`/ip hotspot user set [find name=${sanitize(username)}] disabled=yes`);
  logAction('blockVoucher', { username });
  return result;
}

async function deleteVoucher(username) {
  const result = await ros(`/ip hotspot user remove [find name=${sanitize(username)}]`);
  logAction('deleteVoucher', { username });
  return result;
}

async function createBatch(count, profile, batch) {
  // Auto-generate batch tag if none provided
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

// ✅ Wrapper for CI
// ✅ Wrapper for CI/CD script
async function createVouchers(profile, count) {
  // Simply reuse createBatch with count and profile
  return createBatch(count, profile);
}

// -----------------------------
// Export & Stats
// -----------------------------
async function exportBatch(batchName) {
  const users = await fetchUsers();
  const filtered = users.filter(u => (u.comment || '') === batchName);
  logAction('exportBatch', { batch: batchName, count: filtered.length });
  return filtered;
}

async function exportAll() {
  const users = await fetchUsers();
  logAction('exportAll', { count: users.length });
  return users;
}

async function exportProfiles() {
  const users = await fetchUsers();
  const profiles = {};
  for (const u of users) {
    const key = u.profile || 'default';
    if (!profiles[key]) profiles[key] = 0;
    profiles[key] += 1;
  }
  logAction('exportProfiles', { profiles });
  return profiles;
}

async function getStats() {
  const users = await fetchUsers();
  const total = users.length;
  const active = users.filter(u => u.status === 'active').length;
  const blocked = users.filter(u => u.status === 'blocked').length;
  const byProfile = users.reduce((acc, u) => {
    const key = u.profile || 'default';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const stats = { total, active, blocked, byProfile };
  logAction('stats', stats);
  return stats;
}

// -----------------------------
// Optional: revoke a whole batch
// -----------------------------
async function revokeBatch(batchName) {
  const users = await exportBatch(batchName);
  for (const u of users) {
    await blockVoucher(u.name);
  }
  logAction('revokeBatch', { batch: batchName, count: users.length });
  return { batch: batchName, blocked: users.length };
}

// -----------------------------
// Module Exports
// -----------------------------
module.exports = {
  // Core
  createBatch,
  createVouchers,   // <-- wrapper for CI/CD
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

