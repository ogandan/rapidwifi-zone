// File: modules/adminDashboard.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const csrf = require('csurf');
const voucherManager = require('./voucherManager');
const db = require('../data/db');

// Distribution modules
const { sendSMS } = require('./smsSender');
const { handleWhatsAppMessage } = require('./whatsappBot');
const { handleTelegramCommand } = require('./telegramBot');

module.exports = function(getTunnelURL) {
  const router = express.Router();
  const csrfProtection = csrf({ cookie: true });

  router.use(csrfProtection); // ✅ Apply CSRF to all routes

  // Dashboard page
  router.get('/', async (req, res) => {
    try {
      const vouchers = await voucherManager.fetchUsers();
      const activeUsers = await db.getActiveUsers().catch(() => []);
      const auditLogs = await db.getAuditLogs().catch(() => []);

      res.render('admin', {
        __: res.__,
        tunnelURL: getTunnelURL(),
        vouchers,
        activeUsers,
        auditLogs,
        csrfToken: req.csrfToken()
      });
    } catch (err) {
      console.error('[ADMIN DASHBOARD ERROR]', err);
      res.status(500).send('Error loading dashboard');
    }
  });

  // Batch block
  router.post('/batch/block', async (req, res) => {
    const { usernames } = req.body;
    if (!Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({ error: 'No usernames provided' });
    }
    try {
      for (const u of usernames) {
        await db.logBlock(u);
        await db.logAudit('block', req.user?.username || 'system', u, 'Dashboard', 'success', { batch: true });
      }
      res.json({ success: true, blocked: usernames.length });
    } catch (err) {
      console.error('[BATCH BLOCK ERROR]', err);
      res.status(500).json({ error: 'Batch block failed' });
    }
  });

  // Batch delete
  router.post('/batch/delete', async (req, res) => {
    const { usernames } = req.body;
    if (!Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({ error: 'No usernames provided' });
    }
    try {
      for (const u of usernames) {
        await db.logDelete(u);
        await db.logAudit('delete', req.user?.username || 'system', u, 'Dashboard', 'success', { batch: true });
      }
      res.json({ success: true, deleted: usernames.length });
    } catch (err) {
      console.error('[BATCH DELETE ERROR]', err);
      res.status(500).json({ error: 'Batch delete failed' });
    }
  });

  // Status endpoint
  router.get('/status', (req, res) => {
    try {
      const voucherExport = path.join(__dirname, '../exports/vouchers_all.csv');
      const auditExport = path.join(__dirname, '../exports/audit_logs.csv');

      const status = {
        vouchers_csv: fs.existsSync(voucherExport) ? fs.statSync(voucherExport).mtime : null,
        audit_logs_csv: fs.existsSync(auditExport) ? fs.statSync(auditExport).mtime : null,
        system_uptime: process.uptime()
      };

      res.json(status);
    } catch (err) {
      console.error('[STATUS ERROR]', err);
      res.status(500).json({ error: 'Failed to load status' });
    }
  });

  return router;
};

