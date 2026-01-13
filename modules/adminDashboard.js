// File: modules/adminDashboard.js
// Purpose: Admin dashboard routes

const express = require('express');
const voucherManager = require('./voucherManager');
const db = require('../data/db');
const os = require('os');

module.exports = function(getTunnelURL) {
  const router = express.Router();

  // Dashboard main page
  router.get('/', async (req, res) => {
    try {
      const vouchers = await voucherManager.fetchUsers();

      let activeUsers = [];
      try {
        activeUsers = await db.getActiveUsers();
      } catch (err) {
        console.error('[ADMIN DASHBOARD ERROR] Failed to fetch active users:', err);
      }

      let auditLogs = [];
      try {
        auditLogs = await db.getAuditLogs();
      } catch (err) {
        console.error('[ADMIN DASHBOARD ERROR] Failed to fetch audit logs:', err);
      }

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

  // ✅ Audit logs JSON endpoint
  router.get('/data/audit', async (req, res) => {
    try {
      const { action, username, from, to } = req.query;
      const logs = await db.getFilteredAuditLogs({ action, username, from, to });
      res.json(logs);
    } catch (err) {
      console.error('[ADMIN DATA ERROR] Failed to load audit logs:', err);
      res.status(500).json({ error: 'Failed to load audit logs' });
    }
  });

  return router;
};

