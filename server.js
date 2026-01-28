// -----------------------------------------------------------------------------
// Filename: server.js (Part 1 of 6)
// Timestamp: 2026-01-28 20:25 WAT
// Description: RAPIDWIFI-ZONE captive portal, dashboards, voucher lifecycle,
//              payments integration, notifications, analytics, and audit logs.
// -----------------------------------------------------------------------------

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const csrf = require('csurf');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { exec } = require('child_process');

const voucherManager = require('./modules/voucherManager');
const db = require('./data/db');
const notificationManager = require('./modules/notificationManager');

const app = express();
const csrfProtection = csrf({ cookie: false });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'rapidwifi-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 }
}));

// Apply CSRF globally except for callbacks and APIs
app.use((req, res, next) => {
  if (req.path === '/payments/callback' || req.path.startsWith('/api/')) return next();
  csrfProtection(req, res, next);
});

// CSRF error handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('Invalid CSRF token:', err);
    return res.status(403).render('error', { message: 'Invalid CSRF token. Please refresh and try again.' });
  }
  next(err);
});

// Middleware helpers
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.role === 'admin') return next();
  res.redirect('/admin-login');
}
function requireOperator(req, res, next) {
  if (req.session && req.session.user && req.session.role === 'operator') return next();
  res.redirect('/admin-login');
}

// MikroTik SSH helper
async function getMikroTikProfiles() {
  return new Promise((resolve, reject) => {
    exec(
      'ssh -o PubkeyAcceptedAlgorithms=+ssh-rsa -o HostkeyAlgorithms=+ssh-rsa admin@192.168.88.1 "/ip hotspot user profile print terse"',
      (error, stdout, stderr) => {
        if (error) return reject(error);
        if (stderr) return reject(stderr);
        const lines = stdout.split('\n').filter(l => l.includes('name='));
        const priceMap = {};
        lines.forEach(line => {
          const match = line.match(/name=([^ ]+)/);
          if (match) {
            const name = match[1];
            if (name.includes('-')) {
              const [duration, priceStr] = name.split('-');
              const price = parseInt(priceStr.replace('FCFA', ''), 10);
              priceMap[name] = { duration, price };
            }
          }
        });
        resolve(priceMap);
      }
    );
  });
}
// -----------------------------------------------------------------------------
// Filename: server.js (Part 2 of 6)
// -----------------------------------------------------------------------------

// Voucher login
app.get('/login', async (req, res) => {
  let profiles = {};
  try { profiles = await getMikroTikProfiles(); } catch (err) { console.error("Error fetching MikroTik profiles:", err); }
  res.render('login', { csrfToken: req.csrfToken(), profiles });
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

// Admin login
app.get('/admin-login', (req, res) => res.render('admin_login', { csrfToken: req.csrfToken() }));
app.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const rows = await db.runQuery('SELECT * FROM users WHERE username = ?', [username.trim()]);
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
// -----------------------------------------------------------------------------
// Filename: server.js (Part 3 of 6)
// -----------------------------------------------------------------------------

// Operator dashboard
app.get('/operator', requireOperator, async (req, res) => {
  const totalSoldToday = await db.countOperatorSoldToday(req.session.user);
  let profiles = {};
  try { profiles = await getMikroTikProfiles(); } catch (err) { console.error(err); }
  res.render("operator", { voucher: null, totalSoldToday, csrfToken: req.csrfToken(), role: "operator", toastMessage: null, profiles });
});

// Sell workflow
app.post('/operator/sell', requireOperator, async (req, res) => {
  try {
    const { profile } = req.body;
    let profiles = {};
    try { profiles = await getMikroTikProfiles(); } catch (err) { console.error(err); }
    const expected = profiles[profile];
    if (!expected) {
      return res.render("operator", { voucher: null, totalSoldToday: await db.countOperatorSoldToday(req.session.user), csrfToken: req.csrfToken(), role: "operator", toastMessage: `Profile ${profile} not found on MikroTik`, profiles });
    }
    const voucherUsername = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0,4);
    const voucherPassword = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0,5);
    await voucherManager.createVoucher(voucherUsername, voucherPassword, profile, `batch_${new Date().toISOString().slice(0,10)}`, req.session.user);
    const voucherRow = await db.runQuery("SELECT id, username FROM vouchers WHERE username = ?", [voucherUsername]);
    const voucher = voucherRow[0]; voucher.expectedPrice = expected.price;
    res.render("operator", { voucher, totalSoldToday: await db.countOperatorSoldToday(req.session.user), csrfToken: req.csrfToken(), role: "operator", toastMessage: null, profiles });
  } catch (err) {
    console.error('Sell voucher error:', err);
    let profiles = {}; try { profiles = await getMikroTikProfiles(); } catch (err2) { console.error(err2); }
    res.status(500).render("operator", { voucher: null, totalSoldToday: await db.countOperatorSoldToday(req.session.user), csrfToken: req.csrfToken(), role: "operator", toastMessage: "Error selling voucher", profiles });
  }
});
// -----------------------------------------------------------------------------
// Filename: server.js (Part 4 of 6)
// Timestamp: 2026-01-28 20:50 WAT
// Description: Admin dashboard, voucher list, operator management, bulk actions, exports.
// -----------------------------------------------------------------------------

// Admin dashboard
app.get('/admin', requireAdmin, async (req, res) => {
  const { batch, status, profile } = req.query;
  const vouchers = await voucherManager.listFiltered({ batch, status, profile });
  const operators = await db.getOperators();
  let profiles = {};
  try { profiles = await getMikroTikProfiles(); } catch (err) { console.error(err); }
  res.render('admin', {
    vouchers,
    operators,
    csrfToken: req.csrfToken(),
    role: 'admin',
    profiles,
    batch: batch || '',
    status: status || '',
    profile: profile || ''
  });
});

// DataTables endpoint for vouchers
app.get('/api/vouchers', requireAdmin, async (req, res) => {
  try {
    const vouchers = await db.listVouchers();
    res.json({ data: vouchers });
  } catch (err) {
    console.error("Voucher API error:", err);
    res.status(500).json({ data: [] });
  }
});

// Admin operator management
app.post('/admin/create-operator', requireAdmin, async (req, res) => {
  const { username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await db.runQuery("INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, 'operator', 'active')", [username, hash]);
    res.redirect('/admin');
  } catch (err) {
    console.error("Create operator error:", err);
    res.status(500).send("Error creating operator");
  }
});
app.post('/admin/deactivate-operator/:id', requireAdmin, async (req, res) => {
  try { await db.runQuery("UPDATE users SET status='inactive' WHERE id=?", [req.params.id]); res.redirect('/admin'); }
  catch (err) { console.error("Deactivate operator error:", err); res.status(500).send("Error deactivating operator"); }
});
app.post('/admin/activate-operator/:id', requireAdmin, async (req, res) => {
  try { await db.runQuery("UPDATE users SET status='active' WHERE id=?", [req.params.id]); res.redirect('/admin'); }
  catch (err) { console.error("Activate operator error:", err); res.status(500).send("Error activating operator"); }
});
app.post('/admin/delete-operator/:id', requireAdmin, async (req, res) => {
  try { await db.runQuery("DELETE FROM users WHERE id=?", [req.params.id]); res.redirect('/admin'); }
  catch (err) { console.error("Delete operator error:", err); res.status(500).send("Error deleting operator"); }
});

// Bulk voucher actions
app.post('/admin/bulk-action', requireAdmin, async (req, res) => {
  const { action, ids } = req.body;
  try {
    if (!ids || !Array.isArray(ids)) return res.redirect('/admin');
    const placeholders = ids.map(() => '?').join(',');
    if (action === 'block-voucher') {
      await db.runQuery(`UPDATE vouchers SET status='blocked' WHERE id IN (${placeholders})`, ids);
    } else if (action === 'activate-voucher') {
      await db.runQuery(`UPDATE vouchers SET status='active' WHERE id IN (${placeholders})`, ids);
    } else if (action === 'delete-voucher') {
      await db.runQuery(`DELETE FROM vouchers WHERE id IN (${placeholders})`, ids);
    }
    res.redirect('/admin');
  } catch (err) {
    console.error("Bulk action error:", err);
    res.status(500).send("Error performing bulk action");
  }
});

// Export routes
app.get('/admin/export-all', requireAdmin, async (req, res) => {
  try {
    const vouchers = await voucherManager.listVouchers();
    const csvString = await voucherManager.exportCSV(vouchers);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=vouchers_all.csv");
    res.send(csvString);
  } catch (err) {
    console.error("Export all error:", err);
    res.status(500).send("Error exporting vouchers");
  }
});
app.get('/admin/export-filtered-csv', requireAdmin, async (req, res) => {
  try {
    const vouchers = await voucherManager.listFiltered(req.query);
    const csvString = await voucherManager.exportCSV(vouchers);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=vouchers_filtered.csv");
    res.send(csvString);
  } catch (err) {
    console.error("Export filtered CSV error:", err);
    res.status(500).send("Error exporting vouchers");
  }
});
app.get('/admin/export-filtered-json', requireAdmin, async (req, res) => {
  try { const vouchers = await voucherManager.listFiltered(req.query); res.json({ data: vouchers }); }
  catch (err) { console.error("Export filtered JSON error:", err); res.status(500).json({ data: [] }); }
});
// -----------------------------------------------------------------------------
// Filename: server.js (Part 5 of 6)
// -----------------------------------------------------------------------------

// Analytics dashboard
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

// Logs dashboard
app.get('/admin/logs', requireAdmin, async (req, res) => {
  res.render('audit_logs', { csrfToken: req.csrfToken(), role: 'admin' });
});

// APIs
app.get('/api/payments', async (req, res) => {
  try {
    const payments = await db.getPayments();
    res.json({ data: payments });
  } catch (err) {
    console.error("Payments API error:", err);
    res.status(500).json({ data: [] });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await db.getAuditLogs();
    res.json({ data: logs });
  } catch (err) {
    console.error("Audit logs API error:", err);
    res.status(500).json({ data: [] });
  }
});
// -----------------------------------------------------------------------------
// Filename: server.js (Part 6 of 6)
// Timestamp: 2026-01-28 20:57 WAT
// Description: Self-service payments, logout, and server start.
// -----------------------------------------------------------------------------

// Self-service payment route
app.post('/selfservice/pay', async (req, res) => {
  try {
    const { phone, profile } = req.body;
    let profiles = {};
    try { profiles = await getMikroTikProfiles(); } catch (err) {
      console.error("Error fetching MikroTik profiles:", err);
      return res.json({ success: false, message: "Unable to fetch profiles" });
    }
    const expected = profiles[profile];
    if (!expected) return res.json({ success: false, message: `Profile ${profile} not found` });

    const voucherUsername = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0,4);
    const voucherPassword = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0,5);

    await voucherManager.createVoucher(
      voucherUsername,
      voucherPassword,
      profile,
      `selfservice_${new Date().toISOString().slice(0,10)}`,
      'selfservice'
    );

    await db.runQuery(
      "INSERT INTO payments (voucher_id, amount, method, status, phone) VALUES ((SELECT id FROM vouchers WHERE username=?), ?, 'mobilemoney', 'success', ?)",
      [voucherUsername, expected.price, phone]
    );
    await db.runQuery("UPDATE vouchers SET status='sold' WHERE username=?", [voucherUsername]);

    res.json({
      success: true,
      voucher: {
        username: voucherUsername,
        password: voucherPassword,
        profile,
        price: expected.price
      }
    });
  } catch (err) {
    console.error("Selfservice pay error:", err);
    res.json({ success: false, message: "Payment failed" });
  }
});

// Logout
app.get('/logout', (req, res) => {
  const role = req.session.role;
  req.session.destroy(() => {
    if (role === 'operator' || role === 'admin') return res.redirect('/admin-login');
    return res.redirect('/login');
  });
});

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RAPIDWIFI-ZONE server running on port ${PORT}`);
});

