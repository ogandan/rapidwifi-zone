// File: modules/adminDashboard.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const csrf = require('csurf');

let voucherManager, db, sendSMS, handleWhatsAppMessage, handleTelegramCommand;
try {
  voucherManager = require('./voucherManager.js');
  db = require('../data/db.js');
  ({ sendSMS } = require('./smsSender.js'));
  ({ handleWhatsAppMessage } = require('./whatsappBot.js'));
  ({ handleTelegramCommand } = require('./telegramBot.js'));
} catch (err) {
  console.error('[ADMIN DASHBOARD] Failed to load required modules:', err);
  process.exit(1);
}

module.exports = function(getTunnelURL) {
  const router = express.Router();

  const csrfProtection = csrf({ cookie: true });
  router.use(csrfProtection);

  function renderBadge(status) {
    const safeStatus = ['active', 'blocked', 'expired'].includes(status)
      ? status
      : 'unknown';
    switch (safeStatus) {
      case 'active':
        return '<span class="badge badge-success">Active</span>';
      case 'blocked':
        return '<span class="badge badge-danger">Blocked</span>';
      case 'expired':
        return '<span class="badge badge-secondary">Expired</span>';
      default:
        return '<span class="badge badge-warning">Unknown</span>';
    }
  }

  router.get('/', async (req, res) => {
    try {
      const vouchers = await voucherManager.fetchUsers();
      const vouchersWithBadges = vouchers.map(v => ({
        ...v,
        badge: renderBadge(v.status)
      }));
      const toast = req.query.toast || null;
      res.render('admin', {
        __: res.__,
        tunnelURL: getTunnelURL(),
        vouchers: vouchersWithBadges,
        csrfToken: req.csrfToken(),
        toast
      });
    } catch (err) {
      console.error('[ADMIN DASHBOARD ERROR]', err);
      res.status(500).send('Error loading dashboard');
    }
  });

  router.get('/dashboard', (req, res) => {
    if (req.session && req.session.user) {
      res.json({ ok: true, message: "Admin dashboard reachable" });
    } else {
      res.status(401).json({ ok: false, message: "Unauthorized" });
    }
  });

  router.get('/csrf-token', (req, res) => {
    try {
      res.json({ csrfToken: req.csrfToken() });
    } catch (err) {
      console.error('[CSRF TOKEN ERROR]', err);
      res.status(500).json({ error: 'Failed to generate CSRF token' });
    }
  });

  router.post('/create-voucher', async (req, res) => {
    try {
      const { profile, count } = req.body;
      if (!profile || !count) {
        return res.status(400).json({ success: false, error: 'Missing profile or count' });
      }
      const vouchers = await voucherManager.createVouchers(profile, count);
      db.logAudit?.('create_voucher', req.user?.username || 'admin', null, 'Dashboard', 'success', { profile, count });
      return res.redirect('/?toast=' + encodeURIComponent(`Batch created: ${vouchers.length} vouchers`));
    } catch (err) {
      console.error('[CREATE VOUCHER ERROR]', err);
      res.status(500).json({ success: false, error: err.message || 'Voucher creation failed' });
    }
  });

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
      return res.redirect('/?toast=' + encodeURIComponent(`Blocked ${usernames.length} vouchers`));
    } catch (err) {
      console.error('[BATCH BLOCK ERROR]', err);
      res.status(500).json({ success: false, error: err.message || 'Batch block failed' });
    }
  });

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
      return res.redirect('/?toast=' + encodeURIComponent(`Deleted ${usernames.length} vouchers`));
    } catch (err) {
      console.error('[BATCH DELETE ERROR]', err);
      res.status(500).json({ success: false, error: err.message || 'Batch delete failed' });
    }
  });

  // Remaining endpoints unchanged...
  // Status, audit-logs, stats, distribute/sms, distribute/whatsapp, distribute/telegram

  return router;
};
