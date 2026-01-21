// -----------------------------------------------------------------------------
// Timestamp: 2026-01-21 22:30 WAT
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

// ✅ Mount CSRF middleware globally AFTER session
app.use(csrfProtection);

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
      res.render('login_result', {
        success: true,
        message: 'Login successful',
        role: req.session.role
      });
    } else {
      res.render('login_result', {
        success: false,
        message: 'Invalid voucher',
        role: null
      });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.render('login_result', {
      success: false,
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
app.get('/admin-login', (req, res) => {
  res.render('admin_login', { csrfToken: req.csrfToken() });
});

app.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;

  try {
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
    const match = await bcrypt.compare(password, user.password_hash);

    if (match) {
      req.session.user = user.username;
      req.session.role = user.role;

      if (user.role === 'admin') return res.redirect('/admin');
      if (user.role === 'operator') return res.redirect('/operator');
    }

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
  res.render('admin', {
    vouchers,
    operators,
    tunnelUrl,
    csrfToken: req.csrfToken(),
    role: req.session.role
  });
});

// --------------------
// Admin: Create Voucher
// --------------------
app.post('/admin/create', requireAdmin, async (req, res) => {
  try {
    const { profile, batchTag } = req.body;
    await voucherManager.createVoucher(profile, batchTag);
    res.redirect('/admin');
  } catch (err) {
    console.error('Create voucher error:', err);
    res.status(500).send('Error creating voucher');
  }
});

// --------------------
// Admin: Create Operator
// --------------------
app.post('/admin/create-operator', requireAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    await db.runQuery(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      [username, hash, 'operator']
    );
    res.redirect('/admin');
  } catch (err) {
    console.error('Create operator error:', err);
    res.status(500).send('Error creating operator');
  }
});

// --------------------
// Admin: Bulk Action on Vouchers
// --------------------
app.post('/admin/bulk-action', requireAdmin, async (req, res) => {
  try {
    const { action, voucherIds } = req.body;
    if (!voucherIds) return res.redirect('/admin');

    const ids = Array.isArray(voucherIds) ? voucherIds : [voucherIds];

    if (action === 'block') {
      await db.runQuery(
        `UPDATE vouchers SET status = 'blocked' WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
    } else if (action === 'delete') {
      await db.runQuery(
        `DELETE FROM vouchers WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
    }

    res.redirect('/admin');
  } catch (err) {
    console.error('Bulk action error:', err);
    res.status(500).send('Error applying bulk action');
  }
});

// --------------------
// Operator Dashboard
// --------------------
app.get('/operator', requireOperator, async (req, res) => {
  const vouchers = await voucherManager.listVouchers();
  res.render('operator', {
    vouchers,
    csrfToken: req.csrfToken(),
    role: req.session.role
  });
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
  res.render('analytics', {
    total,
    active,
    inactive,
    profiles,
    exportsByProfile,
    csrfToken: req.csrfToken(),
    role: req.session.role
  });
});

// --------------------
// Logs Dashboard
// --------------------
app.get('/admin/logs', requireAdmin, async (req, res) => {
  const logs = await db.getDownloadLogs();
  res.render('logs', {
    logs,
    csrfToken: req.csrfToken(),
    role: req.session.role
  });
});

// --------------------
// Server Start
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RAPIDWIFI-ZONE server running on port ${PORT}`);
});

