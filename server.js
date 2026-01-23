// -----------------------------------------------------------------------------
// Timestamp: 2026-01-23 11:00 WAT
// File: server.js (Part 1 of 2)
// Purpose: Express server routes for RAPIDWIFI-ZONE captive portal and dashboards
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
app.use(csrfProtection);

// --------------------
// Middleware
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
// Admin/Operator Login
// --------------------
app.get('/admin-login', (req, res) => {
  res.render('admin_login', { csrfToken: req.csrfToken() });
});
app.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const rows = await db.runQuery('SELECT * FROM users WHERE username = ?', [username]);
    if (!rows.length) return res.render('admin_login', { csrfToken: req.csrfToken(), error: 'Invalid credentials' });
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
// Admin Dashboard + Routes
// --------------------
app.get('/admin', requireAdmin, async (req, res) => {
  const vouchers = await voucherManager.listVouchers();
  const operators = await db.getOperators();
  res.render('admin', { vouchers, operators, csrfToken: req.csrfToken(), role: 'admin' });
});

app.post('/admin/create', requireAdmin, async (req, res) => {
  try {
    const { username, password, profile, batchTag } = req.body;
    const tag = batchTag && batchTag.trim() !== '' ? batchTag : `batch_${new Date().toISOString().slice(0, 10)}`;
    await voucherManager.createVoucher(username, password, profile, tag);
    res.redirect('/admin');
  } catch (err) {
    console.error('Create voucher error:', err);
    res.status(500).send('Error creating voucher');
  }
});

app.post('/admin/create-operator', requireAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    await db.runQuery('INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, ?)', [username, hash, 'operator', 'active']);
    res.redirect('/admin');
  } catch (err) {
    console.error('Create operator error:', err);
    res.status(500).send('Error creating operator');
  }
});
// -----------------------------------------------------------------------------
// server.js (Part 2 of 2)
// -----------------------------------------------------------------------------

app.post('/admin/delete-operator/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const hasActions = await db.operatorHasActions(id);
    if (hasActions) {
      await db.deactivateOperator(id);
    } else {
      await db.deleteOperator(id);
    }
    res.redirect('/admin');
  } catch (err) {
    console.error('Delete operator error:', err);
    res.status(500).send('Error deleting operator');
  }
});

app.post('/admin/deactivate-operator/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.deactivateOperator(id);
    res.redirect('/admin');
  } catch (err) {
    console.error('Deactivate operator error:', err);
    res.status(500).send('Error deactivating operator');
  }
});

app.post('/admin/activate-operator/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.activateOperator(id);
    res.redirect('/admin');
  } catch (err) {
    console.error('Activate operator error:', err);
    res.status(500).send('Error activating operator');
  }
});

app.post('/admin/bulk-action', requireAdmin, async (req, res) => {
  try {
    const { action, voucherIds } = req.body;
    if (!voucherIds) return res.redirect('/admin');
    const ids = Array.isArray(voucherIds) ? voucherIds : [voucherIds];
    if (action === 'block') {
      await db.runQuery(`UPDATE vouchers SET status = 'inactive' WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    } else if (action === 'activate') {
      await db.runQuery(`UPDATE vouchers SET status = 'active' WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    } else if (action === 'delete') {
      await db.runQuery(`DELETE FROM vouchers WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
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
  res.render('operator', { vouchers, csrfToken: req.csrfToken(), role: 'operator' });
});

// --------------------
// Analytics Dashboard
// --------------------
app.get('/analytics', requireAdmin, async (req, res) => {
  const counts = await db.getVoucherCounts();
  const profiles = await db.getProfileCounts();
  res.render('analytics', { counts, profiles, csrfToken: req.csrfToken(), role: 'admin' });
});

// --------------------
// Logs Dashboard + Exports
// --------------------
app.get('/admin/logs', requireAdmin, async (req, res) => {
  const logs = await db.getLogs();
  res.render('logs', { logs, csrfToken: req.csrfToken(), role: 'admin' });
});

app.get('/admin/export-all', requireAdmin, async (req, res) => {
  const vouchers = await voucherManager.listVouchers();
  const csv = vouchers.map(v => `${v.id},${v.username},${v.password},${v.profile},${v.status},${v.batch_tag}`).join('\n');
  res.type('text/csv').send(csv);
});

app.get('/admin/export-logs-csv', requireAdmin, async (req, res) => {
  const logs = await db.getLogs();
  const csv = logs.map(l => `${l.id},${l.operator_id},${l.action},${l.timestamp}`).join('\n');
  res.type('text/csv').send(csv);
});

app.get('/admin/export-logs-json', requireAdmin, async (req, res) => {
  const logs = await db.getLogs();
  res.json(logs);
});

// --------------------
// Server Start
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RAPIDWIFI-ZONE server running on port ${PORT}`);
});

