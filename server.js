// -----------------------------------------------------------------------------
// Filename: server.js (Part 1 of 6)
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
              priceMap[duration] = { duration, price };
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
  res.render('login', { csrfToken: req.csrfToken(), profiles, paymentResult: null });
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

// Create Voucher
app.post('/admin/create', requireAdmin, async (req, res) => {
  try {
    const { profile, batchTag } = req.body;
    const voucherUsername = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0,4);
    const voucherPassword = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0,5);
    await voucherManager.createVoucher(voucherUsername, voucherPassword, profile, batchTag || '', req.session.user);
    res.redirect('/admin');
  } catch (err) {
    console.error("Voucher creation error:", err);
    res.redirect('/admin');
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

// Cash payment route
app.post('/operator/pay/cash', requireOperator, async (req, res) => {
  try {
    const { voucherId, amount } = req.body;
    const voucherRow = await db.runQuery("SELECT id, username, password, profile, status FROM vouchers WHERE id=?", [voucherId]);
    if (!voucherRow.length) {
      let profiles = {}; try { profiles = await getMikroTikProfiles(); } catch (err) { console.error(err); }
      return res.render('operator', { voucher: null, totalSoldToday: await db.countOperatorSoldToday(req.session.user), csrfToken: req.csrfToken(), role: "operator", toastMessage: "Voucher not found", profiles });
    }
    const voucher = voucherRow[0];
    let profiles = {}; try { profiles = await getMikroTikProfiles(); } catch (err) { console.error(err); }
    const expected = profiles[voucher.profile];
    if (!expected) {
      return res.render('operator', { voucher, totalSoldToday: await db.countOperatorSoldToday(req.session.user), csrfToken: req.csrfToken(), role: "operator", toastMessage: `Profile ${voucher.profile} not found on MikroTik`, profiles });
    }
    if (parseInt(amount) !== expected.price) {
      return res.render('operator', { voucher, totalSoldToday: await db.countOperatorSoldToday(req.session.user), csrfToken: req.csrfToken(), role: "operator", toastMessage: `Cash received does not match profile price. Expected: ${expected.price} FCFA`, profiles });
    }
    await db.runQuery("UPDATE payments SET status='success', method='cash', amount=? WHERE voucher_id=?", [amount, voucherId]);
    await db.runQuery("UPDATE vouchers SET status='sold' WHERE id=?", [voucherId]);
    res.render('operator', { voucher, totalSoldToday: await db.countOperatorSoldToday(req.session.user), csrfToken: req.csrfToken(), role: "operator", toastMessage: "Voucher sold successfully!", profiles });
  } catch (err) {
    console.error('Cash payment error:', err);
    let profiles = {}; try { profiles = await getMikroTikProfiles(); } catch (err2) { console.error(err2); }
    res.render('operator', { voucher: null, totalSoldToday: await db.countOperatorSoldToday(req.session.user), csrfToken: req.csrfToken(), role: "operator", toastMessage: "Error recording cash payment", profiles });
  }
});
// -----------------------------------------------------------------------------
// Filename: server.js (Part 4 of 6)
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

// Vouchers API
app.get('/api/vouchers', requireAdmin, async (req, res) => {
  try {
    const vouchers = await db.listVouchers();
    res.json({ data: vouchers });
  } catch (err) {
    console.error("Voucher API error:", err);
    res.status(500).json({ data: [] });
  }
});

// Operators API
app.get('/api/operators', requireAdmin, async (req, res) => {
  try {
    const operators = await db.getOperators();
    res.json({ data: operators });
  } catch (err) {
    console.error("Operators API error:", err);
    res.status(500).json({ data: [] });
  }
});

// Operator management page
app.get('/admin/operator-management', requireAdmin, (req, res) => {
  res.render('operator_management', { csrfToken: req.csrfToken(), role: 'admin' });
});

// Operator management routes
app.post('/admin/operator/create', requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await db.runQuery("INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, 'active')", [username, hash, role]);
  res.redirect('/admin/operator-management');
});
app.post('/admin/operator/activate', requireAdmin, async (req, res) => {
  const { id } = req.body;
  await db.activateOperator(id);
  res.redirect('/admin/operator-management');
});
app.post('/admin/operator/deactivate', requireAdmin, async (req, res) => {
  const { id } = req.body;
  await db.deactivateOperator(id);
  res.redirect('/admin/operator-management');
});
app.post('/admin/operator/delete', requireAdmin, async (req, res) => {
  const { id } = req.body;
  const hasActions = await db.operatorHasActions(id);
  if (hasActions) {
    return res.render('operator_management', { csrfToken: req.csrfToken(), role: 'admin', error: 'Cannot delete operator with existing actions' });
  }
  await db.deleteOperator(id);
  res.redirect('/admin/operator-management');
});

// Export routes
app.get('/admin/export-all', requireAdmin, async (req, res) => {
  const vouchers = await db.listVouchers();
  res.header("Content-Type", "text/csv");
  res.attachment("vouchers_all.csv");
  res.send(await voucherManager.exportCSV(vouchers));
});
app.get('/admin/export-filtered-csv', requireAdmin, async (req, res) => {
  const { batch, status, profile } = req.query;
  const vouchers = await voucherManager.listFiltered({ batch, status, profile });
  res.header("Content-Type", "text/csv");
  res.attachment("vouchers_filtered.csv");
  res.send(await voucherManager.exportCSV(vouchers));
});
app.get('/admin/export-filtered-json', requireAdmin, async (req, res) => {
  const { batch, status, profile } = req.query;
  const vouchers = await voucherManager.listFiltered({ batch, status, profile });
  res.json(vouchers);
});

// Logs page
app.get('/admin/logs', requireAdmin, (req, res) => {
  res.render('audit_logs', { csrfToken: req.csrfToken(), role: 'admin' });
});

// Payments API
app.get('/api/payments', requireAdmin, async (req, res) => {
  try {
    const payments = await db.getPayments();
    res.json({ data: payments });
  } catch (err) {
    console.error("Payments API error:", err);
    res.status(500).json({ data: [] });
  }
});

// Bulk voucher actions with expired restriction
app.post('/admin/vouchers/bulk-activate', requireAdmin, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.json({ success: false });
  await db.runQuery(`UPDATE vouchers SET status='active' WHERE id IN (${ids.join(',')}) AND status!='expired'`);
  res.json({ success: true });
});
app.post('/admin/vouchers/bulk-block', requireAdmin, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.json({ success: false });
  await db.runQuery(`UPDATE vouchers SET status='inactive' WHERE id IN (${ids.join(',')})`);
  res.json({ success: true });
});
app.post('/admin/vouchers/bulk-delete', requireAdmin, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.json({ success: false });
  await db.runQuery(`DELETE FROM vouchers WHERE id IN (${ids.join(',')})`);
  res.json({ success: true });
});
// -----------------------------------------------------------------------------
// Filename: server.js (Part 5 of 6)
// -----------------------------------------------------------------------------

// Audit logs API
app.get('/api/audit-logs', requireAdmin, async (req, res) => {
  try {
    const logs = await db.getAuditLogs();
    res.json({ data: logs });
  } catch (err) {
    console.error("Audit logs API error:", err);
    res.status(500).json({ data: [] });
  }
});

// Analytics page
app.get('/analytics', requireAdmin, async (req, res) => {
  try {
    const stats = await db.getAnalyticsStats();
    res.render('analytics', { 
      active: stats.active, 
      inactive: stats.inactive, 
      csrfToken: req.csrfToken(), 
      role: 'admin' 
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.render('analytics', { active: 0, inactive: 0, csrfToken: req.csrfToken(), role: 'admin' });
  }
});
// -----------------------------------------------------------------------------
// Filename: server.js (Part 6 of 6)
// -----------------------------------------------------------------------------

// Self-service payment
app.post('/selfservice/pay', async (req, res) => {
  try {
    const { phone, profile } = req.body;
    const voucherUsername = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0,4);
    const voucherPassword = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0,5);
    await voucherManager.createVoucher(voucherUsername, voucherPassword, profile, 'selfservice', 'selfservice');
    await db.runQuery(
      "INSERT INTO payments (voucher_id, amount, currency, method, status, phone, timestamp) VALUES ((SELECT id FROM vouchers WHERE username=?), ?, 'XOF', 'mobilemoney', 'success', ?, datetime('now'))",
      [voucherUsername, 500, phone]
    );
    res.render('login', { 
      csrfToken: req.csrfToken(), 
      profiles: await getMikroTikProfiles(), 
      paymentResult: { 
        success: true, 
        voucher: { username: voucherUsername, password: voucherPassword, profile, price: 500 } 
      } 
    });
  } catch (err) {
    console.error("Selfservice pay error:", err);
    res.render('login', { 
      csrfToken: req.csrfToken(), 
      profiles: await getMikroTikProfiles(), 
      paymentResult: { success: false, message: "Payment failed" } 
    });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin-login');
  });
});

// ✅ Correct port binding
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RAPIDWIFI-ZONE server running on port ${PORT}`);
});

