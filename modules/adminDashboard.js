// File: modules/adminDashboard.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const csrf = require('csurf');

const voucherManager = require('./voucherManager');
const db = require('../data/db');

const { sendSMS } = require('./smsSender');
const { handleWhatsAppMessage } = require('./whatsappBot');
const { handleTelegramCommand } = require('./telegramBot');

module.exports = function(getTunnelURL) {
  const router = express.Router();

  const csrfProtection = csrf({ cookie: true });
  router.use(csrfProtection);

  // Dashboard page (HTML view)
  router.get('/', async (req, res) => {
    try {
      const vouchers = await voucherManager.fetchUsers();
      res.render('admin', {
        __: res.__,
        tunnelURL: getTunnelURL(),
        vouchers,
        csrfToken: req.csrfToken()
      });
    } catch (err) {
      console.error('[ADMIN DASHBOARD ERROR]', err);
      res.status(500).send('Error loading dashboard');
    }
  });

  // Health check
  router.get('/dashboard', (req, res) => {
    if (req.session && req.session.user) {
      res.json({ ok: true, message: "Admin dashboard reachable" });
    } else {
      res.status(401).json({ ok: false, message: "Unauthorized" });
    }
  });

  // CSRF token
  router.get('/csrf-token', (req, res) => {
    try {
      res.json({ csrfToken: req.csrfToken() });
    } catch (err) {
      console.error('[CSRF TOKEN ERROR]', err);
      res.status(500).json({ error: 'Failed to generate CSRF token' });
    }
  });

  // Voucher creation
  router.post('/create-voucher', async (req, res) => {
    try {
      const { profile, count } = req.body;
      if (!profile || !count) {
        return res.status(400).json({ success: false, error: 'Missing profile or count' });
      }
      const vouchers = await voucherManager.createVouchers(profile, count);
      db.logAudit?.('create_voucher', req.user?.username || 'admin', null, 'Dashboard', 'success', { profile, count });
      res.json({ success: true, created: vouchers.length, vouchers });
    } catch (err) {
      console.error('[CREATE VOUCHER ERROR]', err);
      res.status(500).json({ success: false, error: err.message || 'Voucher creation failed' });
    }
  });

  // Batch block
  router.post('/batch/block', async (req, res) => {
    try {
      const { usernames } = req.body;
      if (!Array.isArray(usernames) || usernames.length === 0) {
        return res.status(400).json({ success: false, error: 'No usernames provided' });
      }
      for (const username of usernames) {
        await voucherManager.blockVoucher(username);
        db.logBlock?.(username);
        db.logAudit?.('block', req.user?.username || 'admin', username, 'Dashboard', 'success', { batch: true });
      }
      res.json({ success: true, processed: usernames.length, action: 'block' });
    } catch (err) {
      console.error('[BATCH BLOCK ERROR]', err);
      res.status(500).json({ success: false, error: err.message || 'Batch block failed' });
    }
  });

  // Batch delete
  router.post('/batch/delete', async (req, res) => {
    try {
      const { usernames } = req.body;
      if (!Array.isArray(usernames) || usernames.length === 0) {
        return res.status(400).json({ success: false, error: 'No usernames provided' });
      }
      for (const username of usernames) {
        await voucherManager.deleteVoucher(username);
        db.logDelete?.(username);
        db.logAudit?.('delete', req.user?.username || 'admin', username, 'Dashboard', 'success', { batch: true });
      }
      res.json({ success: true, processed: usernames.length, action: 'delete' });
    } catch (err) {
      console.error('[BATCH DELETE ERROR]', err);
      res.status(500).json({ success: false, error: err.message || 'Batch delete failed' });
    }
  });

  // Status
  router.get('/status', (req, res) => {
    try {
      const voucherExport = path.join(__dirname, '../exports/vouchers_all.csv');
      const auditExport = path.join(__dirname, '../exports/audit_logs.csv');
      const status = {
        vouchers_csv: fs.existsSync(voucherExport) ? fs.statSync(voucherExport).mtime.toISOString() : null,
        audit_logs_csv: fs.existsSync(auditExport) ? fs.statSync(auditExport).mtime.toISOString() : null,
        system_uptime: Math.floor(process.uptime())
      };
      res.json(status);
    } catch (err) {
      console.error('[STATUS ERROR]', err);
      res.status(500).json({ error: 'Failed to load status' });
    }
  });

  // ✅ Audit logs endpoint for CI/CD
  router.get('/audit-logs', async (req, res) => {
    try {
      const logsFile = path.join(__dirname, '../exports/audit_logs.csv');
      if (!fs.existsSync(logsFile)) {
        return res.json({ ok: true, logs: [] });
      }
      const content = fs.readFileSync(logsFile, 'utf8');
      const lines = content.trim().split('\n').slice(1); // skip header
      const logs = lines.map(line => {
        const [timestamp, action, user, target, source, status, meta] = line.split(',');
        return { timestamp, action, user, target, source, status, meta };
      });
      res.json({ ok: true, logs });
    } catch (err) {
      console.error('[AUDIT LOGS ERROR]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ✅ Stats endpoint for CI/CD
  router.get('/stats', async (req, res) => {
    try {
      const stats = await voucherManager.getStats();
      res.json({ ok: true, stats });
    } catch (err) {
      console.error('[STATS ERROR]', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Distribution endpoints
  router.post('/distribute/sms', async (req, res) => {
    try {
      const { number, voucher } = req.body;
      const ok = await sendSMS(number, voucher);
      db.logAudit?.('distribute_sms', req.user?.username || 'admin', voucher, 'SMS', ok ? 'success' : 'fail', { number });
      res.json({ success: !!ok });
    } catch (err) {
      console.error('[SMS DISTRIBUTE ERROR]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/distribute/whatsapp', async (req, res) => {
    try {
      const { userId, message } = req.body;
      const ok = await handleWhatsAppMessage(userId, message);
      db.logAudit?.('distribute_whatsapp', req.user?.username || 'admin', message, 'WhatsApp', ok ? 'success' : 'fail', { userId });
      res.json({ success: !!ok });
    } catch (err) {
      console.error('[WHATSAPP DISTRIBUTE ERROR]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/distribute/telegram', async (req, res) => {
    try {
      const { userId, command } = req.body;
      const ok = await handleTelegramCommand(userId, command);
      db.logAudit?.('distribute_telegram', req.user?.username || 'admin', command, 'Telegram', ok ? 'success' : 'fail', { userId });
      res.json({ success: !!ok });
    } catch (err) {
      console.error('[TELEGRAM DISTRIBUTE ERROR]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};

