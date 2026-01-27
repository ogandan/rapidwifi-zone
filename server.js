// -----------------------------------------------------------------------------
// File: server.js (Part 1 of 4)
// Purpose: RAPIDWIFI-ZONE captive portal, dashboards, voucher lifecycle,
//          payments integration, and notifications.
// -----------------------------------------------------------------------------

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const csrf = require('csurf');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const voucherManager = require('./modules/voucherManager');
const db = require('./data/db');
const notificationManager = require('./modules/notificationManager');

const app = express();

// --------------------
// CSRF Protection
// --------------------
const csrfProtection = csrf({ cookie: false });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --------------------
// Session Config
// --------------------
app.use(session({
  secret: 'rapidwifi-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 // 1 hour
  }
}));

// --------------------
// Apply CSRF Middleware Globally
// --------------------
app.use((req, res, next) => {
  // Exempt callback and API routes from CSRF
  if (req.path === '/payments/callback' || req.path.startsWith('/api/')) return next();
  csrfProtection(req, res, next);
});

// --------------------
// CSRF Error Handler
// --------------------
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('Invalid CSRF token:', err);
    return res.status(403).render('error', { message: 'Invalid CSRF token. Please refresh and try again.' });
  }
  next(err);
});

// --------------------
// Middleware Helpers
// --------------------
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.role === 'admin') return next();
  res.redirect('/admin-login');
}
function requireOperator(req, res, next) {
  if (req.session && req.session.user && req.session.role === 'operator') return next();
  res.redirect('/admin-login');
}
// --------------------
// Voucher Login
// --------------------
app.get('/login', (req, res) => {
  res.render('login', { csrfToken: req.csrfToken() });
});
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const voucher = await voucherManager.validateVoucher(username, password);
    if (voucher) {
      req.session.user = username;
      req.session.role = 'user';
      res.render('login_result', { success: true, message: 'Login successful', role: 'user' });
    } else {
      res.render('login_result', { success: false, message: 'Invalid voucher', role: null });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.render('login_result', { success: false, message: 'System error during login', role: null });
  }
});

// --------------------
// Admin Login
// --------------------
app.get('/admin-login', (req, res) => {
  res.render('admin_login', { csrfToken: req.csrfToken() });
});

app.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const rows = await db.runQuery('SELECT * FROM users WHERE username = ?', [username.trim()]);
    if (!rows.length) {
      return res.render('admin_login', { csrfToken: req.csrfToken(), error: 'Invalid credentials' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (match) {
      req.session.user = user.username;
      req.session.role = user.role;
      if (user.role === 'admin') return res.redirect('/admin');
      if (user.role === 'operator') return res.redirect('/operator');
    }
    res.render('admin_login', { csrfToken: req.csrfToken(), error: 'Invalid credentials' });
  } catch (err) {
    console.error('Admin login error:', err);
    res.render('admin_login', { csrfToken: req.csrfToken(), error: 'System error during login' });
  }
});

// --------------------
// Self-Service Payment
// --------------------
app.post('/selfservice/pay', async (req, res) => {
  try {
    const { phone, profile } = req.body;

    const voucherUsername = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0,4);
    const voucherPassword = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0,5);

    await voucherManager.createVoucher(
      voucherUsername,
      voucherPassword,
      profile,
      `batch_${new Date().toISOString().slice(0,10)}`
    );

    const voucherRow = await db.runQuery(
      "SELECT id FROM vouchers WHERE username = ? AND password = ?",
      [voucherUsername, voucherPassword]
    );
    const voucherId = voucherRow[0].id;

    const amount = profile === '1h' ? 500 : profile === 'day' ? 1000 : 5000;
    await db.runQuery(
      "INSERT INTO payments (voucher_id, amount, method, status, currency, timestamp) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [voucherId, amount, 'mobile_money', 'pending', 'XOF']
    );

    res.render('payment_result', { success: true, message: `Payment initiated. Voucher: ${voucherUsername}/${voucherPassword}` });
  } catch (err) {
    console.error('Self-service payment error:', err);
    res.render('payment_result', { success: false, message: 'Error initiating payment' });
  }
});
// --------------------
// JSON APIs
// --------------------
app.get('/api/payments', requireAdmin, async (req, res) => {
  try {
    const payments = await db.getPayments();
    res.json({ status: 'success', data: payments });
  } catch (err) {
    console.error('Payments API error:', err);
    res.json({ status: 'error', message: 'Unable to fetch payments' });
  }
});

app.get('/api/audit_logs', requireAdmin, async (req, res) => {
  try {
    const logs = await db.getAuditLogs();
    res.json({ status: 'success', data: logs });
  } catch (err) {
    console.error('Audit Logs API error:', err);
    res.json({ status: 'error', message: 'Unable to fetch audit logs' });
  }
});

// --------------------
// Mobile Money Callback Handler
// --------------------
app.post('/payments/callback', async (req, res) => {
  try {
    const body = req.body;

    if (body.externalId && body.status) {
      console.log("📩 Sandbox callback received:", body);

      await db.runQuery("UPDATE payments SET status=? WHERE voucher_id=?", [body.status.toLowerCase(), body.externalId]);

      if (body.status === 'SUCCESSFUL' || body.status.toLowerCase() === 'success') {
        await db.runQuery("UPDATE vouchers SET status=? WHERE id=?", ['sold', body.externalId]);
        notificationManager.sendVoucherSold(body.externalId);
      }

      return res.json({ success: true, sandbox: true });
    }

    res.status(400).send('Bad callback format');
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).send('Server error');
  }
});

// --------------------
// Admin Dashboard + Routes
// --------------------
app.get('/admin', requireAdmin, async (req, res) => {
  const vouchers = await voucherManager.listVouchers();
  const operators = await db.getOperators();
  res.render('admin', { vouchers, operators, csrfToken: req.csrfToken(), role: 'admin' });
});

// Voucher creation route
app.post('/admin/create', requireAdmin, async (req, res) => {
  try {
    const { profile, batchTag } = req.body;
    const voucherUsername = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0,4);
    const voucherPassword = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0,5);

    await voucherManager.createVoucher(
      voucherUsername,
      voucherPassword,
      profile,
      batchTag || `batch_${new Date().toISOString().slice(0,10)}`
    );

    res.redirect('/admin');
  } catch (err) {
    console.error('Voucher creation error:', err);
    res.status(500).send('Error creating voucher');
  }
});
// --------------------
// Operator Dashboard
// --------------------
app.get('/operator', requireOperator, async (req, res) => {
  const vouchers = await voucherManager.listVouchers();
    const totalSoldToday = await db.countOperatorSoldToday(req.session.user);
    res.render("operator", { vouchers, totalSoldToday, csrfToken: req.csrfToken(), role: "operator" });
});

// --------------------
// Analytics Dashboard (with payments)
// --------------------
app.get('/analytics', requireAdmin, async (req, res) => {
  const total = await db.countAllVouchers();
  const active = await db.countActiveVouchers();
  const inactive = await db.countInactiveVouchers();
  const profiles = await db.countProfiles();
  const exportsByProfile = await db.countExportsByProfile();

  const payments = await db.getPayments();
  const totalPayments = payments.length;
  const successfulPayments = payments.filter(p => p.status === 'success').length;
  const failedPayments = payments.filter(p => p.status === 'failed').length;
  const revenueByMethod = {};
  payments.forEach(p => {
    revenueByMethod[p.method] = (revenueByMethod[p.method] || 0) + p.amount;
  });

  const paymentsByDate = await db.getPaymentsByDate();
  const revenueTrend = await db.getRevenueTrend();
  const profileRevenue = await db.getProfileRevenue();

  res.render('analytics', {
    total,
    active,
    inactive,
    profiles,
    exportsByProfile,
    totalPayments,
    successfulPayments,
    failedPayments,
    revenueByMethod,
    paymentsByDate,
    revenueTrend,
    profileRevenue,
    csrfToken: req.csrfToken(),
    role: 'admin'
  });
});

// --------------------
// Logs Dashboard (Audit Logs + Payments)
// --------------------
app.get('/admin/logs', requireAdmin, async (req, res) => {
  res.render('audit_logs', { csrfToken: req.csrfToken(), role: 'admin' });
});

app.get('/admin/export-all', requireAdmin, async (req, res) => {
  const vouchers = await voucherManager.listVouchers();
  const csv = vouchers.map(v => `${v.id},${v.username},${v.password},${v.profile},${v.status},${v.batch_tag}`).join('\n');
  res.type('text/csv').send(csv);
});

app.get('/admin/export-logs-csv', requireAdmin, async (req, res) => {
  const logs = await db.getLogs();
  const csv = logs.map(l => `${l.id},${l.profile},${l.filename},${l.exported_by},${l.timestamp}`).join('\n');
  res.type('text/csv').send(csv);
});

app.get('/admin/export-logs-json', requireAdmin, async (req, res) => {
  const logs = await db.getLogs();
  res.json(logs);
});

// --------------------
// Extra Routes
// --------------------
app.post('/pay/cash', async (req, res) => {
  try {
    const { voucherId, amount } = req.body;
    await db.runQuery("UPDATE payments SET status='success', method='cash', amount=? WHERE voucher_id=?", [amount, voucherId]);
    await db.runQuery("UPDATE vouchers SET status='sold' WHERE id=?", [voucherId]);
    const voucher = await db.runQuery("SELECT username, password FROM vouchers WHERE id=?", [voucherId]);
    if (voucher.length > 0) {
      res.render('payment_result', { success: true, message: `Cash payment recorded. Voucher: ${voucher[0].username}/${voucher[0].password}` });
    } else {
      res.render('payment_result', { success: true, message: 'Cash payment recorded, but voucher credentials not found.' });
    }
  } catch (err) {
    console.error('Cash payment error:', err);
    res.render('payment_result', { success: false, message: 'Error recording cash payment' });
  }
});

app.get('/logout', (req, res) => {
  const role = req.session.role;
  req.session.destroy(() => {
    if (role === 'operator' || role === 'admin') return res.redirect('/admin-login');
    return res.redirect('/login');
  });
});

// --------------------
// Server Start
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RAPIDWIFI-ZONE server running on port ${PORT}`);
});

