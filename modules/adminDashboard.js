// File: modules/adminDashboard.js
// Purpose: Admin dashboard routes

const express = require('express');
const path = require('path');
const voucherManager = require('./voucherManager');
const db = require('../data/db');
const os = require('os');
const fs = require('fs');

// Distribution modules
const { sendSMS } = require('./smsSender');
const { handleWhatsAppMessage } = require('./whatsappBot');
const { handleTelegramCommand } = require('./telegramBot');

module.exports = function(getTunnelURL) {
  const router = express.Router();

  // Dashboard main page
  router.get('/', async (req, res) => {
    try {
      const vouchers = await voucherManager.fetchUsers();
      const activeUsers = await db.getActiveUsers().catch(() => []);
      const auditLogs = await db.getAuditLogs().catch(() => []);

      const systemHealth = {
        uptime: process.uptime(),
        load: os.loadavg(),
        memory: {
          free: os.freemem(),
          total: os.totalmem()
        }
      };

      res.render('admin', {
        __: res.__,
        tunnelURL: getTunnelURL(),
        vouchers,
        activeUsers,
        auditLogs,
        systemHealth
      });
    } catch (err) {
      console.error('[ADMIN DASHBOARD ERROR] Unexpected failure:', err);
      res.status(500).send('Error loading dashboard');
    }
  });

  // JSON endpoints
  router.get('/data/vouchers', async (req, res) => {
    try {
      const users = await voucherManager.fetchUsers();
      const counts = {};
      users.forEach(u => {
        counts[u.profile] = (counts[u.profile] || 0) + 1;
      });
      res.json({
        counts,
        total: users.length,
        blocked: users.filter(u => u.status === 'blocked').length,
        active: users.filter(u => u.status === 'active').length
      });
    } catch (err) {
      console.error('[ADMIN DATA ERROR] Failed to load voucher data:', err);
      res.status(500).json({ error: 'Failed to load voucher data' });
    }
  });

  router.get('/data/system', (req, res) => {
    try {
      res.json({
        uptime: process.uptime(),
        load: os.loadavg(),
        memory: {
          free: os.freemem(),
          total: os.totalmem()
        }
      });
    } catch (err) {
      console.error('[ADMIN DATA ERROR] Failed to load system data:', err);
      res.status(500).json({ error: 'Failed to load system data' });
    }
  });

  // Audit logs JSON endpoint
  router.get('/data/audit', async (req, res) => {
    try {
      const { action, username, from, to, profile } = req.query;
      const logs = await db.getFilteredAuditLogs({ action, username, from, to, profile });
      res.json(logs);
    } catch (err) {
      console.error('[ADMIN DATA ERROR] Failed to load audit logs:', err);
      res.status(500).json({ error: 'Failed to load audit logs' });
    }
  });

  // --- Distribution endpoints with audit logging ---
  router.post('/distribute/sms', async (req, res) => {
    const { number, voucher, batch } = req.body;
    try {
      const result = await sendSMS(number, voucher);
      await db.logAudit('sms_distribution', req.user?.username || 'system', voucher, 'SMS',
        result?.success ? 'success' : 'failed', { recipient: number, batchTag: batch || null });
      res.json(result);
    } catch (err) {
      console.error('[ADMIN DISTRIBUTION ERROR] SMS failed:', err);
      await db.logAudit('sms_distribution', req.user?.username || 'system', voucher, 'SMS',
        'failed', { recipient: number, errorMessage: String(err), batchTag: batch || null });
      res.status(500).json({ error: 'SMS distribution failed' });
    }
  });

  router.post('/distribute/whatsapp', async (req, res) => {
    const { userId, message, voucher, batch } = req.body;
    try {
      const result = await handleWhatsAppMessage(userId, message || voucher);
      await db.logAudit('whatsapp_distribution', req.user?.username || 'system', voucher || message,
        'WhatsApp', result?.success ? 'success' : 'failed', { recipient: userId, batchTag: batch || null });
      res.json(result);
    } catch (err) {
      console.error('[ADMIN DISTRIBUTION ERROR] WhatsApp failed:', err);
      await db.logAudit('whatsapp_distribution', req.user?.username || 'system', voucher || message,
        'WhatsApp', 'failed', { recipient: userId, errorMessage: String(err), batchTag: batch || null });
      res.status(500).json({ error: 'WhatsApp distribution failed' });
    }
  });

  router.post('/distribute/telegram', async (req, res) => {
    const { userId, command, voucher, batch } = req.body;
    try {
      const result = await handleTelegramCommand(userId, command || voucher);
      await db.logAudit('telegram_distribution', req.user?.username || 'system', voucher || command,
        'Telegram', result?.success ? 'success' : 'failed', { recipient: userId, batchTag: batch || null });
      res.json(result);
    } catch (err) {
      console.error('[ADMIN DISTRIBUTION ERROR] Telegram failed:', err);
      await db.logAudit('telegram_distribution', req.user?.username || 'system', voucher || command,
        'Telegram', 'failed', { recipient: userId, errorMessage: String(err), batchTag: batch || null });
      res.status(500).json({ error: 'Telegram distribution failed' });
    }
  });

  // --- Batch actions (block/delete vouchers) ---
  router.post('/batch/block', async (req, res) => {
    const { usernames } = req.body; // array of voucher usernames
    try {
      for (const u of usernames) {
        await db.logBlock(u);
        await db.logAudit('block', req.user?.username || 'system', u, 'Dashboard', 'success', { batch: true });
      }
      res.json({ success: true, blocked: usernames.length });
    } catch (err) {
      console.error('[ADMIN BATCH ERROR] Block failed:', err);
      res.status(500).json({ error: 'Batch block failed' });
    }
  });

  router.post('/batch/delete', async (req, res) => {
    const { usernames } = req.body; // array of voucher usernames
    try {
      for (const u of usernames) {
        await db.logDelete(u);
        await db.logAudit('delete', req.user?.username || 'system', u, 'Dashboard', 'success', { batch: true });
      }
      res.json({ success: true, deleted: usernames.length });
    } catch (err) {
      console.error('[ADMIN BATCH ERROR] Delete failed:', err);
      res.status(500).json({ error: 'Batch delete failed' });
    }
  });

  // --- Unified export routes ---
  router.get('/export/vouchers.csv', (req, res) => {
    try {
      res.download(path.join(__dirname, '../exports/vouchers_all.csv'));
    } catch (err) {
      console.error('[ADMIN EXPORT ERROR] Failed to export vouchers:', err);
      res.status(500).send('Voucher export failed');
    }
  });

  router.get('/export/audit_logs.csv', (req, res) => {
    try {
      res.download(path.join(__dirname, '../exports/audit_logs.csv'));
    } catch (err) {
      console.error('[ADMIN EXPORT ERROR] Failed to export audit logs:', err);
      res.status(500).send('Audit log export failed');
    }
  });

  // --- Status endpoint ---
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
      console.error('[ADMIN STATUS ERROR] Failed to load status:', err);
      res.status(500).json({ error: 'Failed to load status' });
    }
  });

  return router;
};

