// File: modules/adminDashboard.js
// Purpose: Admin dashboard routes

const express = require('express');
const voucherManager = require('./voucherManager');
const db = require('../data/db');

module.exports = function(getTunnelURL) {
  const router = express.Router();

  // Dashboard main page
  router.get('/', async (req, res) => {
    try {
      const vouchers = await voucherManager.fetchUsers();
      const activeUsers = await db.getActiveUsers();
      const auditLogs = await db.getAuditLogs();
      const systemHealth = {
        uptime: process.uptime(),
        load: require('os').loadavg(),
        memory: {
          free: require('os').freemem(),
          total: require('os').totalmem()
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
      console.error('[ADMIN DASHBOARD ERROR]', err);
      res.status(500).send('Error loading dashboard');
    }
  });

  return router;
};

