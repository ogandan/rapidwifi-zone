// server.js - RAPIDWIFI-ZONE baseline backend
process.on('uncaughtException', err => console.error('[FATAL ERROR]', err));
process.on('unhandledRejection', err => console.error('[UNHANDLED PROMISE]', err));

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const voucherManager = require('./modules/voucherManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'rapidwifi-secret',
  resave: false,
  saveUninitialized: false
}));

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));

app.post('/login', async (req, res) => {
  const { username } = req.body;
  const voucher = await voucherManager.validateVoucher(username);
  if (voucher) {
    req.session.user = voucher.username;
    res.redirect('/status');
  } else {
    res.status(401).send('Invalid voucher');
  }
});

app.get('/status', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.send(`Logged in as ${req.session.user}`);
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Admin dashboard route
app.get('/admin', async (req, res) => {
  try {
    const vouchers = await voucherManager.listVouchers();
    let tunnelUrl = '';
    try {
      tunnelUrl = fs.readFileSync(path.join(__dirname, 'data/tunnel_url.txt'), 'utf8').trim();
    } catch (err) {
      tunnelUrl = 'No tunnel URL available';
    }
    res.render('admin.ejs', { vouchers, tunnelUrl });
  } catch (err) {
    console.error('Error loading admin dashboard:', err);
    res.status(500).send('Error loading admin dashboard');
  }
});

// Admin API routes
app.get('/admin/vouchers', async (req, res) => {
  const vouchers = await voucherManager.listVouchers();
  res.json(vouchers);
});

app.post('/admin/vouchers/create', async (req, res) => {
  const { profile } = req.body;
  const voucher = await voucherManager.createVoucher(profile);
  res.json(voucher);
});

app.post('/admin/vouchers/disable', async (req, res) => {
  const { username } = req.body;
  const result = await voucherManager.disableVoucher(username);
  res.json(result);
});

// Start server
app.listen(PORT, () => console.log(`RAPIDWIFI backend running on port ${PORT}`));

