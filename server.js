const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const db = require('./data/db'); // assumes you have db.js with voucher functions

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// EJS view engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static assets (CSS, JS, images if needed)
app.use('/styles', express.static(path.join(__dirname, 'styles')));

// --------------------
// Hotspot Login Routes
// --------------------

// Landing page: login form
app.get('/', (req, res) => {
  res.render('login.ejs');
});

// Voucher login handler
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const voucher = await db.getVoucherByUsername(username);

    if (!voucher) {
      return res.status(401).json({ ok: false, error: 'Invalid username' });
    }

    if (voucher.password !== password) {
      return res.status(401).json({ ok: false, error: 'Incorrect password' });
    }

    if (voucher.status !== 'active') {
      return res.status(403).json({ ok: false, error: 'Voucher not active' });
    }

    // Successful login
    return res.json({ ok: true, message: 'Login successful' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// --------------------
// Admin Dashboard Route
// --------------------

app.get('/admin', async (req, res) => {
  try {
    const vouchers = await db.getRecentVouchers();
    const tunnelUrl = await db.getTunnelUrl(); // reads from data/tunnel_url.txt

    res.render('admin.ejs', { vouchers, tunnelUrl });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading admin dashboard');
  }
});

// --------------------
// Start Server
// --------------------

app.listen(PORT, () => {
  console.log(`RAPIDWIFI-ZONE server running on http://localhost:${PORT}`);
});

