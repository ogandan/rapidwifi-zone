// server.js - RAPIDWIFI-ZONE main entry point
const express = require('express');
const session = require('express-session');
const csrf = require('csurf');
const bodyParser = require('body-parser');
const db = require('./data/db');
const voucherManager = require('./modules/voucherManager');

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'rapidwifi-secret', resave: false, saveUninitialized: true }));
app.use(csrf());

// --------------------
// Middleware
// --------------------
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.role !== 'admin') return res.status(403).send('Forbidden');
  next();
}
function requireOperator(req, res, next) {
  if (!req.session.user || req.session.role !== 'operator') return res.status(403).send('Forbidden');
  next();
}

// --------------------
// Auth Routes
// --------------------
app.get('/login', (req, res) => res.render('login', { csrfToken: req.csrfToken() }));
app.post('/login', async (req, res) => {
  const { username } = req.body;
  const voucher = await voucherManager.validateVoucher(username);
  if (voucher) {
    req.session.user = username;
    req.session.role = 'user';
    res.render('login_result', { ok: true, message: 'Login successful' });
  } else {
    res.render('login_result', { ok: false, message: 'Invalid voucher' });
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

// Operator Dashboard
app.get('/operator', requireOperator, async (req, res) => {
  const vouchers = await voucherManager.listVouchers();
  res.render('operator', { vouchers });
});

// --------------------
// Voucher Lifecycle
// --------------------
app.post('/admin/create-voucher', requireAdmin, async (req, res) => {
  const { profile } = req.body;
  const voucher = await voucherManager.createVoucher(profile);
  res.json(voucher);
});

app.post('/admin/disable-voucher', requireAdmin, async (req, res) => {
  const { username } = req.body;
  const result = await voucherManager.disableVoucher(username);
  res.json(result);
});

// --------------------
// Payments
// --------------------
app.post('/pay/mtn', requireAdmin, async (req, res) => {
  const { user, amount } = req.body;
  const result = await voucherManager.initiateMTNPayment(user, amount);
  res.json(result);
});

app.post('/pay/moov', requireAdmin, async (req, res) => {
  const { user, amount } = req.body;
  const result = await voucherManager.initiateMoovPayment(user, amount);
  res.json(result);
});

app.post('/pay/cash', requireOperator, async (req, res) => {
  const { user, amount, profile } = req.body;
  const result = await voucherManager.recordCashPayment(req.session.user, user, amount, profile);
  res.json(result);
});

// --------------------
// Voucher Delivery
// --------------------
app.post('/deliver-voucher/:id', requireAdmin, async (req, res) => {
  const { channel, recipient } = req.body;
  const voucherId = req.params.id;
  const voucher = { username: voucherId }; // simplified lookup
  let result;
  if (channel === 'SMS') result = await voucherManager.deliverVoucherSMS(voucher, recipient);
  else if (channel === 'WhatsApp') result = await voucherManager.deliverVoucherWhatsApp(voucher, recipient);
  else if (channel === 'Telegram') result = await voucherManager.deliverVoucherTelegram(voucher, recipient);
  res.json(result);
});

// --------------------
// Analytics
// --------------------
app.get('/admin/stats', requireAdmin, async (req, res) => {
  const creation7days = await voucherManager.voucherCreationLast7Days();
  const trends = await voucherManager.voucherCreationTrends();
  const exportsOverTime = await voucherManager.countExportsOverTime();
  const active = await db.countActiveVouchers();
  const inactive = await db.countInactiveVouchers();
  const profiles = await db.countProfiles();
  const exportsByProfile = await db.countExportsByProfile();
  res.json({ active, inactive, profiles, creation7days, trends, exportsOverTime, exportsByProfile });
});

// --------------------
// Logs
// --------------------
app.get('/admin/logs', requireAdmin, async (req, res) => {
  const logs = await db.getDownloadLogs();
  res.render('logs', { logs });
});

// --------------------
// Tunnel Management
// --------------------
app.post('/admin/tunnel', requireAdmin, async (req, res) => {
  const { url } = req.body;
  await db.saveTunnelUrl(url);
  res.json({ ok: true, tunnelUrl: url });
});

// --------------------
// Operator Management
// --------------------
app.post('/admin/create-operator', requireAdmin, async (req, res) => {
  const { name } = req.body;
  const operator = await db.createOperator(name);
  res.json(operator);
});

app.post('/admin/delete-operator', requireAdmin, async (req, res) => {
  const { id } = req.body;
  const hasActions = await db.operatorHasActions(id);
  if (hasActions) {
    res.json({ ok: false, message: 'Operator cannot be deleted after performing actions' });
  } else {
    await db.deleteOperator(id);
    res.json({ ok: true });
  }
});

// --------------------
// Start server
// --------------------
app.listen(3000, () => console.log('RAPIDWIFI-ZONE running on port 3000'));

