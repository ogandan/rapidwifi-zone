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

  // ✅ New voucher creation endpoint for CI/CD
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

  // … batch block, batch delete, status, distribute endpoints unchanged …

  return router;
};

