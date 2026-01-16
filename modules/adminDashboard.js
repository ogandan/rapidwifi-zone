// modules/adminDashboard.js — Part 1

const express = require('express');
const router = express.Router();
const csrf = require('csurf');
const voucherManager = require('./voucherManager');
const fs = require('fs');
const path = require('path');

// Middleware to enforce login
const requireLogin = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.redirect('/login');
};

// CSRF protection
const csrfProtection = csrf({ cookie: true });
router.use(requireLogin);
router.use(csrfProtection);

// Admin dashboard view
router.get('/', async (req, res) => {
  try {
    const vouchers = await voucherManager.getAll();
    res.render('admin', {
      vouchers,
      toast: req.session.toast || null,
      csrfToken: req.csrfToken()
    });
    req.session.toast = null;
  } catch (err) {
    console.error('Error loading vouchers:', err);
    res.status(500).send('Error loading dashboard');
  }
});
// modules/adminDashboard.js — Part 2

// Create vouchers
router.post('/create-voucher', async (req, res) => {
  try {
    const { count, profile, batch } = req.body;
    const created = await voucherManager.createBatch(count, profile, batch);
    req.session.toast = `Batch created: ${created.length} vouchers`;
    res.redirect('/admin');
  } catch (err) {
    console.error('Error creating vouchers:', err);
    res.status(500).send('Error creating vouchers');
  }
});

// Block vouchers
router.post('/batch/block', async (req, res) => {
  try {
    const { selected } = req.body;
    await voucherManager.block(selected);
    req.session.toast = `Blocked ${selected.length} vouchers`;
    res.redirect('/admin');
  } catch (err) {
    console.error('Error blocking vouchers:', err);
    res.status(500).send('Error blocking vouchers');
  }
});

// Delete vouchers
router.post('/batch/delete', async (req, res) => {
  try {
    const { selected } = req.body;
    await voucherManager.delete(selected);
    req.session.toast = `Deleted ${selected.length} vouchers`;
    res.redirect('/admin');
  } catch (err) {
    console.error('Error deleting vouchers:', err);
    res.status(500).send('Error deleting vouchers');
  }
});
// modules/adminDashboard.js — Part 3

// Export vouchers CSV
router.get('/export/vouchers.csv', async (req, res) => {
  try {
    const file = path.join(__dirname, '../data/vouchers_all.csv');
    res.download(file, 'vouchers.csv');
  } catch (err) {
    console.error('Error exporting vouchers:', err);
    res.status(500).send('Error exporting vouchers');
  }
});

// Export audit logs CSV
router.get('/export/audit_logs.csv', async (req, res) => {
  try {
    const file = path.join(__dirname, '../data/audit_logs.csv');
    res.download(file, 'audit_logs.csv');
  } catch (err) {
    console.error('Error exporting audit logs:', err);
    res.status(500).send('Error exporting audit logs');
  }
});

// Chart data for vouchers
router.get('/data/vouchers', async (req, res) => {
  try {
    const stats = await voucherManager.getStats();
    res.json(stats);
  } catch (err) {
    console.error('Error fetching voucher stats:', err);
    res.status(500).send('Error fetching voucher stats');
  }
});

// Chart data for system
router.get('/data/system', async (req, res) => {
  try {
    const systemStats = await voucherManager.getSystemStats();
    res.json(systemStats);
  } catch (err) {
    console.error('Error fetching system stats:', err);
    res.status(500).send('Error fetching system stats');
  }
});

module.exports = router;

