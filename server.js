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
app.use(csrfProtection);

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

// --------------------
// Login Routes
// --------------------
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/admin');
  res.render('login', { csrfToken: req.csrfToken() });
});

app.post('/login', csrfProtection, async (req, res) => {
  const { username, password } = req.body;
  try {
    const voucher = await db.getVoucherByUsername(username);
    if (!voucher) return res.render('login_result', { ok: false, message: 'Invalid username' });
    if (voucher.password !== password) return res.render('login_result', { ok: false, message: 'Incorrect password' });
    if (voucher.status !== 'active') return res.render('login_result', { ok: false, message: 'Voucher not active' });

    req.session.user = voucher.username;
    res.redirect('/admin'); // ✅ redirect ensures fresh CSRF token
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
app.get('/admin', requireLogin, async (req, res) => {
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
app.post('/admin/create-operator', requireLogin, csrfProtection, async (req, res) => {
  const { username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 12);
    await new Promise((resolve, reject) => {
      db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'operator')",
        [username, hash],
        function (err) {
          if (err) return reject(err);
          resolve(true);
        });
    });
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error creating operator');
  }
});

app.post('/admin/delete-operator/:id', requireLogin, csrfProtection, async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM users WHERE id = ?", [req.params.id], function (err) {
        if (err) return reject(err);
        resolve(true);
      });
    });
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error deleting operator');
  }
});

// Voucher Management
app.post('/admin/create', requireLogin, csrfProtection, async (req, res) => {
  const { profile, batchTag } = req.body;
  try {
    await db.createVoucher(profile, batchTag);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error creating voucher');
  }
});

app.post('/admin/block/:id', requireLogin, csrfProtection, async (req, res) => {
  try {
    await db.blockVoucher(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error blocking voucher');
  }
});

app.post('/admin/delete/:id', requireLogin, csrfProtection, async (req, res) => {
  try {
    await db.deleteVoucher(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error deleting voucher');
  }
});

// Bulk Action Route
app.post('/admin/bulk-action', requireLogin, csrfProtection, async (req, res) => {
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
app.get('/admin/logs', requireLogin, async (req, res) => {
  try {
    let logs = await db.getDownloadLogs(500);
    res.render('logs', { logs, totalPages: 1, currentPage: 1, query: {} });
  } catch (err) {
    console.error(err);
    res.send('Error loading logs');
  }
});

app.get('/admin/export-logs', requireLogin, async (req, res) => {
  try {
    let logs = await db.getDownloadLogs(500);
    const fields = [
      { label: 'Action', value: 'action' },
      { label: 'Filename', value: 'filename' },
      { label: 'User', value: 'user' },
      { label: 'Timestamp', value: 'timestamp' }
    ];
    return exportCSV(res, logs, 'download_logs.csv', fields);
  } catch (err) {
    console.error(err);
    res.send('Error exporting logs');
  }
});

// Analytics Page
app.get('/analytics', requireLogin, (req, res) => {
  res.render('analytics', { csrfToken: req.csrfToken() });
});

// Stats Endpoints
app.get('/admin/stats', requireLogin, async (req, res) => {
  try {
    const total = await db.countAllVouchers();
    const active = await db.countActiveVouchers();
    const inactive = await db.countInactiveVouchers();
    const exportsToday = await db.countExportsToday();
    const profiles = await db.countVouchersByProfile();
    const exportsByProfile = await db.countExportsByProfile();
    const creation = await db.voucherCreationOverTime();

    res.json({ total, active, inactive, exportsToday, profiles, exportsByProfile, creation });
  } catch (err) {
    console.error(err);
    res.json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://192.168.88.2:${PORT}`);
});

