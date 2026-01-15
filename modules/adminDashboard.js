// File: modules/adminDashboard.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const csrf = require('csurf');

const voucherManager = require('./voucherManager');
const db = require('../data/db');

// Optional distribution modules (kept for consistency)
const { sendSMS } = require('./smsSender');
const { handleWhatsAppMessage } = require('./whatsappBot');
const { handleTelegramCommand } = require('./telegramBot');

module.exports = function(getTunnelURL) {
  const router = express.Router();

  // ✅ CSRF protection for all admin routes in this module
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

  // ✅ Lightweight JSON health check for CI/CD
  router.get('/dashboard', (req, res) => {
    if (req.session && req.session.user) {
      res.json({ ok: true, message: "Admin dashboard reachable" });
    } else {
      res.status(401).json({ ok: false, message: "Unauthorized" });
    }
  });

  // ✅ Batch block — performs actual block via voucherManager and logs audit
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

  // ✅ Batch delete — performs actual delete via voucherManager and logs audit
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

  // ✅ Status endpoint — last modification times of CSVs + uptime
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

  // (Optional) distribution endpoints — include CSRF
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

