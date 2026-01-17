// -----------------------------
// File: server.js
// -----------------------------
require('dotenv').config();

const express = require('express');
const app = express(); // ✅ define app immediately

const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const i18n = require('i18n');
const expressSession = require('express-session'); // ✅ renamed to avoid collision
const os = require('os');
const csurf = require('csurf');
const cookieParser = require('cookie-parser');

// Import hardened auth module and helpers
const { router: authV2, requireAuth, requireRole } = require(path.join(__dirname, 'modules', 'auth', 'app-auth.js'));

const voucherManager = require(path.join(__dirname, 'modules', 'voucherManager'));
const paymentHandler = require(path.join(__dirname, 'modules', 'paymentHandler'));
const emailAlerts = require(path.join(__dirname, 'modules', 'emailAlerts'));
const db = require(path.join(__dirname, 'data', 'db'));
const { getFilteredAuditLogs, exportLogsToCSV } = require('./modules/auditLogger');

const PORT = parseInt(process.env.PORT || '3000', 10);

// -----------------------------
// i18n setup
// -----------------------------
i18n.configure({
  locales: ['en', 'fr'],
  directory: path.join(__dirname, 'locales'),
  defaultLocale: 'en',
  queryParameter: 'lang'
});
app.use(i18n.init);

// -----------------------------
// Sessions
// -----------------------------
app.use(expressSession({
  secret: process.env.SESSION_SECRET || 'rapidwifi-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// -----------------------------
// Middleware
// -----------------------------
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// -----------------------------
// Helpers
// -----------------------------
function getTunnelURL() {
  try {
    const urlPath = path.join(__dirname, 'data', 'tunnel_url.txt');
    return fs.readFileSync(urlPath, 'utf8').trim();
  } catch (err) {
    console.error('[TUNNEL URL ERROR]', err);
    return 'http://localhost:3000';
  }
}

// -----------------------------
// SAFETY: Mount authV2 under a separate path
// -----------------------------
// app.use('/authv2', authV2);
app.use('/', authV2);

// -----------------------------
// Auth routes
// -----------------------------
const csrfProtection = csurf({ cookie: true });

app.get('/login', csrfProtection, (req, res) => {
  res.render('login', { error: null, __: res.__, csrfToken: req.csrfToken() });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/', (req, res) => {
  res.render('index', { __: res.__, tunnelURL: getTunnelURL() });
});

// -----------------------------
// Payment handler
// -----------------------------
app.post('/payment', async (req, res) => {
  try {
    const result = await paymentHandler.processPayment(req.body);
    if (result.success) {
      await voucherManager.createBatch(1, result.profile, `payment-${Date.now()}`);
      res.render('success', { __: res.__ });
    } else {
      res.render('error', { __: res.__ });
    }
  } catch (err) {
    console.error('[PAYMENT ERROR]', err);
    emailAlerts.systemError(err.message);
    res.render('error', { __: res.__ });
  }
});

// -----------------------------
// Admin dashboard
// -----------------------------
const adminDashboard = require(path.join(__dirname, 'modules', 'adminDashboard'));
app.use('/admin', requireAuth, requireRole('ADMIN'), adminDashboard);

app.get('/audit', requireAuth, requireRole('ADMIN'), (req, res) => {
  res.render('audit', { __: res.__ });
});

// -----------------------------
// Voucher creation
// -----------------------------
app.post('/admin/voucher/create', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { count, profile, batch } = req.body;
  try {
    const created = await voucherManager.createBatch(
      parseInt(count, 10) || 1,
      profile || 'default',
      batch || `batch-${Date.now()}`
    );
    created.forEach(v => db.logVoucher?.(v.name, v.profile));
    res.json({ success: true, created });
  } catch (err) {
    console.error('[ADMIN CREATE ERROR]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------
// Batch actions
// -----------------------------
app.post('/admin/voucher/batch', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { selected, action } = req.body;
    const usernames = Array.isArray(selected) ? selected : (selected ? [selected] : []);
    if (!usernames.length || !action) {
      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    for (const username of usernames) {
      if (action === 'block') {
        await voucherManager.blockVoucher(username);
        db.logBlock?.(username);
      } else if (action === 'delete') {
        await voucherManager.deleteVoucher(username);
        db.logDelete?.(username);
      }
    }

    res.json({ success: true, processed: usernames.length, action });
  } catch (err) {
    console.error('[ADMIN BATCH ERROR]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -----------------------------
// CSV export
// -----------------------------
app.get('/admin/export/vouchers.csv', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const users = await voucherManager.exportAll();
    const header = 'Username,Password,Profile,Price,Batch,Status\n';
    const body = users
      .map(u => `${u.name},${u.password},${u.profile},,${u.comment},${u.status}`)
      .join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('vouchers_all.csv');
    res.send(header + body);
  } catch (err) {
    console.error('[EXPORT VOUCHERS ERROR]', err);
    res.status(500).send('Error exporting vouchers');
  }
});

app.get('/admin/export/audit.csv', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { action, username, from, to, profile } = req.query;
    const logs = getFilteredAuditLogs({ action, username, from, to, profile });
    const csv = exportLogsToCSV(logs);
    res.header('Content-Type', 'text/csv');
    res.attachment('audit.csv');
    res.send(csv);
  } catch (err) {
    console.error('[EXPORT AUDIT ERROR]', err);
    res.status(500).send('Error exporting audit logs');
  }
});

// -----------------------------
// Chart.js data endpoints
// -----------------------------
app.get('/admin/data/vouchers', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const users = await voucherManager.fetchUsers();
    const counts = {};
    users.forEach(u => {
      counts[u.profile] = (counts[u.profile] || 0) + 1;
    });
    res.json(counts);
  } catch (err) {
    console.error('[CHART VOUCHERS ERROR]', err);
    res.status(500).json({ error: 'Failed to load voucher data' });
  }
});

app.get('/admin/data/system', requireAuth, requireRole('ADMIN'), (req, res) => {
  try {
    res.json({
      load: os.loadavg(),
      uptime: os.uptime(),
      memory: { free: os.freemem(), total: os.totalmem() }
    });
  } catch (err) {
    console.error('[CHART SYSTEM ERROR]', err);
    res.status(500).json({ error: 'Failed to load system data' });
  }
});

// -----------------------------
// Voucher API routes
// -----------------------------
const vouchersRouter = require(path.join(__dirname, 'routes', 'vouchers'));
app.use(vouchersRouter);

// -----------------------------
// Error handling
// -----------------------------
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  emailAlerts.systemError(err.message);
  res.status(500).send('Internal Server Error');
});

// -----------------------------
// Start server
// -----------------------------
app.listen(PORT, () => {
  console.log(`RAPIDWIFI-ZONE running on port ${PORT}`);
});

