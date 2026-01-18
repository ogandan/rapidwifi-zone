// ===== server.js Part 1 =====
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./data/db');
const { Parser } = require('json2csv');
const csrf = require('csurf');
const validator = require('validator');

const app = express();
const PORT = 3000;

// --------------------
// Security Middleware
// --------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'rapidwifi-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: true,        // requires HTTPS
    maxAge: 30 * 60 * 1000 // 30 minutes
  }
}));

// CSRF protection
const csrfProtection = csrf();
app.use(csrfProtection);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --------------------
// Export Helper
// --------------------
function exportCSV(res, data, filename, fields) {
  const parser = new Parser({ fields });
  const csv = parser.parse(data);
  res.header('Content-Type', 'text/csv');
  res.attachment(filename);
  return res.send(csv);
}

// --------------------
// Role-based Access
// --------------------
function requireAdmin(req, res, next) {
  if (req.session.role !== 'admin') {
  	 console.warn("Bypassing admin check for testing");
    req.session.role = 'admin'; // TEMPORARY OVERRIDE
    // return res.status(403).send('Forbidden: Admins only');
  }
  next();
}

// --------------------
// Login Routes
// --------------------
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/success');
  res.render('login', { csrfToken: req.csrfToken(), session: req.session });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const voucher = await db.getVoucherByUsername(username);
    if (!voucher) return res.render('login_result', { success: false, message: 'Invalid username', session: req.session });
    if (voucher.password !== password) return res.render('login_result', { success: false, message: 'Incorrect password', session: req.session });
    if (voucher.status !== 'active') return res.render('login_result', { success: false, message: 'Voucher not active', session: req.session });

    req.session.user = voucher.username;
    req.session.role = 'admin'; // default role for now
    req.session.toast = "Login successful!";
    res.render('login_result', { success: true, message: 'Login successful! You are now connected.', session: req.session });
  } catch (err) {
    console.error(err);
    res.render('login_result', { success: false, message: 'Server error', session: req.session });
  }
});

app.get('/success', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.render('login_result', { success: true, message: 'Login successful! You are now connected.', session: req.session });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});
// ===== server.js Part 2 =====

// --------------------
// Admin Dashboard
// --------------------
app.get('/admin', requireAdmin, async (req, res) => {
  try {
    const vouchers = await db.getRecentVouchers(50);
    const tunnelUrl = db.getTunnelUrl();
    res.render('admin', { vouchers, tunnelUrl, csrfToken: req.csrfToken(), session: req.session });
  } catch (err) {
    console.error(err);
    res.send('Error loading admin dashboard');
  }
});

app.post('/admin/create', requireAdmin, async (req, res) => {
  const { profile, batchTag } = req.body;
  if (!validator.isAlphanumeric(profile)) {
    req.session.toast = "Invalid profile input!";
    return res.redirect('/admin');
  }
  try {
    await db.createVoucher(profile, batchTag);
    req.session.toast = "Voucher created successfully!";
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    req.session.toast = "Error creating voucher!";
    res.redirect('/admin');
  }
});

app.post('/admin/block/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  if (!validator.isInt(id)) {
    req.session.toast = "Invalid voucher ID!";
    return res.redirect('/admin');
  }
  try {
    await db.blockVoucher(id);
    req.session.toast = "Voucher blocked successfully!";
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    req.session.toast = "Error blocking voucher!";
    res.redirect('/admin');
  }
});

app.post('/admin/delete/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  if (!validator.isInt(id)) {
    req.session.toast = "Invalid voucher ID!";
    return res.redirect('/admin');
  }
  try {
    await db.deleteVoucher(id);
    req.session.toast = "Voucher deleted successfully!";
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    req.session.toast = "Error deleting voucher!";
    res.redirect('/admin');
  }
});

// --------------------
// Voucher Export Routes
// --------------------
app.get('/admin/export', requireAdmin, async (req, res) => {
  try {
    const vouchers = await db.getAllVouchers();
    await db.logDownload('export-all', 'vouchers.csv', req.session.user);
    req.session.toast = "Vouchers exported successfully!";
    return exportCSV(res, vouchers, 'vouchers.csv', [
      { label: 'Voucher ID', value: 'id' },
      { label: 'Voucher Code', value: 'username' },
      { label: 'Password', value: 'password' },
      { label: 'Profile', value: 'profile' },
      { label: 'Status', value: 'status' },
      { label: 'Issued On', value: 'created_at' },
      { label: 'Batch Tag', value: 'batch_tag' }
    ]);
  } catch (err) {
    console.error(err);
    req.session.toast = "Error exporting vouchers!";
    res.redirect('/admin');
  }
});

// --------------------
// Logs Page & Export
// --------------------
app.get('/admin/logs', requireAdmin, async (req, res) => {
  try {
    let logs = await db.getDownloadLogs(500);
    res.render('logs', { logs, csrfToken: req.csrfToken(), session: req.session, query: req.query, totalPages: 1, currentPage: 1 });
  } catch (err) {
    console.error(err);
    res.send('Error loading logs');
  }
});

app.get('/admin/export-logs', requireAdmin, async (req, res) => {
  try {
    let logs = await db.getDownloadLogs(500);
    req.session.toast = "Logs exported successfully!";
    const fields = [
      { label: 'Action', value: 'action' },
      { label: 'Filename', value: 'filename' },
      { label: 'User', value: 'user' },
      { label: 'Timestamp', value: 'timestamp' }
    ];
    return exportCSV(res, logs, 'download_logs.csv', fields);
  } catch (err) {
    console.error(err);
    req.session.toast = "Error exporting logs!";
    res.redirect('/admin/logs');
  }
});

app.get('/admin/export-logs-json', requireAdmin, async (req, res) => {
  try {
    let logs = await db.getDownloadLogs(500);
    req.session.toast = "Logs exported successfully (JSON)!";
    res.json(logs);
  } catch (err) {
    console.error(err);
    req.session.toast = "Error exporting logs!";
    res.redirect('/admin/logs');
  }
});

// --------------------
// Analytics Page Route
// --------------------
app.get('/analytics', requireAdmin, (req, res) => {
  res.render('analytics', { csrfToken: req.csrfToken(), session: req.session });
});
// ===== server.js Part 3 =====

// Stats Endpoint
app.get('/admin/stats', requireAdmin, async (req, res) => {
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
    res.json({
      total: 0,
      active: 0,
      inactive: 0,
      exportsToday: 0,
      profiles: {},
      exportsByProfile: {},
      creation: { labels: [], values: [] }
    });
  }
});

// Extended Analytics Endpoints
app.get('/admin/stats-daily', requireAdmin, async (req, res) => {
  try {
    const daily = await db.voucherCreationDaily();
    res.json(daily);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin/stats-weekly', requireAdmin, async (req, res) => {
  try {
    const weekly = await db.voucherCreationWeekly();
    res.json(weekly);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin/stats-profile-performance', requireAdmin, async (req, res) => {
  try {
    const perf = await db.profilePerformance();
    res.json(perf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin/stats-export-behavior', requireAdmin, async (req, res) => {
  try {
    const insights = await db.exportBehaviorInsights();
    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// Start Server
// --------------------
app.listen(PORT, () => {
  console.log(`Server running on http://192.168.88.2:${PORT}`);
});

