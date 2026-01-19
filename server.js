// ===== server.js Part 1 =====
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./data/db');
const { Parser } = require('json2csv');
const csrf = require('csurf');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'rapidwifi-secret',
  resave: false,
  saveUninitialized: true
}));

const csrfProtection = csrf();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

function exportCSV(res, data, filename, fields) {
  const parser = new Parser({ fields });
  const csv = parser.parse(data);
  res.header('Content-Type', 'text/csv');
  res.attachment(filename);
  return res.send(csv);
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.role === 'voucher') {
    return res.redirect('/');
  }
  next();
}

// --------------------
// Login Routes
// --------------------
app.get('/', csrfProtection, (req, res) => {
  res.render('login', { csrfToken: req.csrfToken() });
});

app.post('/login', csrfProtection, async (req, res) => {
  const { username, password, type } = req.body;
  try {
    if (type === 'voucher') {
      const voucher = await db.getVoucherByUsername(username);
      if (!voucher) return res.render('login_result', { ok: false, message: 'Invalid voucher' });
      if (voucher.password !== password) return res.render('login_result', { ok: false, message: 'Incorrect voucher password' });
      if (voucher.status !== 'active') return res.render('login_result', { ok: false, message: 'Voucher not active' });

      req.session.user = voucher.username;
      req.session.role = 'voucher';
      return res.render('login_result', { ok: true, message: 'Voucher accepted. Internet access granted.' });
    } else {
      const operator = await db.getOperatorByUsername(username);
      if (!operator) return res.render('login_result', { ok: false, message: 'Invalid admin/operator' });
      const match = await bcrypt.compare(password, operator.password_hash);
      if (!match) return res.render('login_result', { ok: false, message: 'Incorrect password' });

      req.session.user = operator.username;
      req.session.role = operator.role;
      return res.redirect('/admin');
    }
  } catch (err) {
    console.error(err);
    res.render('login_result', { ok: false, message: 'Server error' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});
// ===== server.js Part 2 =====

// --------------------
// Admin Dashboard
// --------------------
app.get('/admin', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const vouchers = await db.getRecentVouchers(50);
    const operators = await db.getOperators();
    const tunnelUrl = db.getTunnelUrl();
    res.render('admin', {
      vouchers,
      operators,
      tunnelUrl,
      csrfToken: req.csrfToken()
    });
  } catch (err) {
    console.error(err);
    res.render('login_result', { ok: false, message: 'Error loading admin dashboard' });
  }
});

// Operator Management
app.post('/admin/create-operator', requireAdmin, csrfProtection, async (req, res) => {
  const { username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 12);
    await db.createOperator(username, hash);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error creating operator');
  }
});

app.post('/admin/delete-operator/:id', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const hasActions = await db.operatorHasActions(req.params.id);
    if (hasActions) {
      return res.send('Cannot delete operator with existing actions (audit integrity)');
    }
    await db.deleteOperator(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error deleting operator');
  }
});

// Voucher Management
app.post('/admin/create', requireAdmin, csrfProtection, async (req, res) => {
  const { profile, batchTag } = req.body;
  try {
    await db.createVoucher(profile, batchTag);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error creating voucher');
  }
});

app.post('/admin/block/:id', requireAdmin, csrfProtection, async (req, res) => {
  try {
    await db.blockVoucher(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error blocking voucher');
  }
});

app.post('/admin/delete/:id', requireAdmin, csrfProtection, async (req, res) => {
  try {
    await db.deleteVoucher(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error deleting voucher');
  }
});

// Bulk Action Route
app.post('/admin/bulk-action', requireAdmin, csrfProtection, async (req, res) => {
  const { action, voucherIds } = req.body;
  const ids = Array.isArray(voucherIds) ? voucherIds : [voucherIds];
  try {
    for (const id of ids) {
      if (action === 'block') await db.blockVoucher(id);
      if (action === 'delete') await db.deleteVoucher(id);
    }
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error applying bulk action');
  }
});
// ===== server.js Part 3 =====

// Logs Page & Export
app.get('/admin/logs', requireAdmin, async (req, res) => {
  try {
    let logs = await db.getDownloadLogs(500);
    res.render('logs', { logs, totalPages: 1, currentPage: 1, query: {} });
  } catch (err) {
    console.error(err);
    res.send('Error loading logs');
  }
});

// Export all vouchers
app.get('/admin/export-all', requireAdmin, async (req, res) => {
  try {
    let vouchers = await db.getAllVouchers();
    const fields = ['id', 'username', 'password', 'profile', 'status', 'batch_tag'];
    return exportCSV(res, vouchers, 'all_vouchers.csv', fields);
  } catch (err) {
    console.error(err);
    res.send('Error exporting vouchers');
  }
});

// Export filtered logs (CSV)
app.get('/admin/export-logs-csv', requireAdmin, async (req, res) => {
  try {
    let logs = await db.getFilteredLogs(req.query);
    const fields = ['action', 'filename', 'user', 'timestamp'];
    return exportCSV(res, logs, 'filtered_logs.csv', fields);
  } catch (err) {
    console.error(err);
    res.send('Error exporting logs CSV');
  }
});

// Export filtered logs (JSON)
app.get('/admin/export-logs-json', requireAdmin, async (req, res) => {
  try {
    let logs = await db.getFilteredLogs(req.query);
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.send('Error exporting logs JSON');
  }
});

// Analytics Page
app.get('/analytics', requireAdmin, csrfProtection, async (req, res) => {
  res.render('analytics', { csrfToken: req.csrfToken() });
});

// Stats Endpoints
app.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    const total = await db.countAllVouchers();
    const active = await db.countActiveVouchers();
    const inactive = await db.countInactiveVouchers();
    const profiles = await db.countVouchersByProfile();
    const creation7days = await db.voucherCreationLast7Days();
    const trends = await db.voucherCreationTrends();
    const exportsByProfile = await db.countExportsByProfile();
    const exportsOverTime = await db.countExportsOverTime();

    res.json({
      total,
      active,
      inactive,
      profiles,
      creation7days,
      trends,
      exportsByProfile,
      exportsOverTime
    });
  } catch (err) {
    console.error(err);
    res.json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://192.168.88.2:${PORT}`);
});

