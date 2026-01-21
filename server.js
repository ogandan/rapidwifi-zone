// -----------------------------------------------------------------------------
// Timestamp: 2026-01-21 11:35 WAT
// File: server.js
// Purpose: Express server routes for RAPIDWIFI-ZONE captive portal and dashboards
// Path: /home/chairman/rapidwifi-zone/server.js
// -----------------------------------------------------------------------------

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const csrf = require('csurf');
const path = require('path');
const bcrypt = require('bcrypt');

const voucherManager = require('./modules/voucherManager');
const db = require('./data/db');

const app = express();
const csrfProtection = csrf({ cookie: false });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'rapidwifi-secret',
  resave: false,
  saveUninitialized: true
}));

// --------------------
// Middleware
// --------------------
function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') return next();
  res.redirect('/admin-login');
}

function requireOperator(req, res, next) {
  if (req.session && req.session.role === 'operator') return next();
  res.redirect('/admin-login');
}

// --------------------
// Voucher Login (Captive Portal)
// --------------------
app.get('/login', csrfProtection, (req, res) => {
  res.render('login', { csrfToken: req.csrfToken() });
});

app.post('/login', csrfProtection, async (req, res) => {
  try {
    const { username, password } = req.body;
    const voucher = await voucherManager.validateVoucher(username, password);

    if (voucher) {
      req.session.user = username;
      req.session.role = 'user';
      res.render('login_result', {
        ok: true,
        message: 'Login successful',
        role: req.session.role
      });
    } else {
      res.render('login_result', {
        ok: false,
        message: 'Invalid voucher',
        role: null
      });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.render('login_result', {
      ok: false,
      message: 'System error during login',
      role: null
    });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.render('logout');
  });
});

// --------------------
// Admin/Operator Login
// --------------------
app.get('/admin-login', csrfProtection, (req, res) => {
  res.render('admin_login', { csrfToken: req.csrfToken() });
});

app.post('/admin-login', csrfProtection, async (req, res) => {
  const { username, password } = req.body;

  try {
    // Query the users table
    const rows = await db.runQuery(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (!rows.length) {
      return res.render('admin_login', {
        csrfToken: req.csrfToken(),
        error: 'Invalid credentials'
      });
    }

    const user = rows[0];

    // Compare provided password with stored hash
    const match = await bcrypt.compare(password, user.password_hash);

    if (match) {
      req.session.user = user.username;
      req.session.role = user.role; // 'admin' or 'operator'

      if (user.role === 'admin') return res.redirect('/admin');
      if (user.role === 'operator') return res.redirect('/operator');
    }

    // If password mismatch
    res.render('admin_login', {
      csrfToken: req.csrfToken(),
      error: 'Invalid credentials'
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.render('admin_login', {
      csrfToken: req.csrfToken(),
      error: 'System error during login'
    });
  }
});

// --------------------
// Admin Dashboard
// --------------------
app.get('/admin', requireAdmin, async (req, res) => {
  const vouchers = await voucherManager.listVouchers();
  const operators = await db.getOperators();
  const tunnelUrl = await db.getTunnelUrl();
  res.render('admin', { vouchers, operators, tunnelUrl });
});

// --------------------
// Operator Dashboard
// --------------------
app.get('/operator', requireOperator, async (req, res) => {
  const vouchers = await voucherManager.listVouchers();
  res.render('operator', { vouchers });
});

// --------------------
// Analytics Dashboard
// --------------------
app.get('/analytics', requireAdmin, async (req, res) => {
  const total = await db.countAllVouchers();
  const active = await db.countActiveVouchers();
  const inactive = await db.countInactiveVouchers();
  const profiles = await db.countProfiles();
  const exportsByProfile = await db.countExportsByProfile();
  res.render('analytics', { total, active, inactive, profiles, exportsByProfile });
});

// --------------------
// Logs Dashboard
// --------------------
app.get('/admin/logs', requireAdmin, async (req, res) => {
  const logs = await db.getDownloadLogs();
  res.render('logs', { logs });
});

// --------------------
// Server Start
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RAPIDWIFI-ZONE server running on port ${PORT}`);
});

