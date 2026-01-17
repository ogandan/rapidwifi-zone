const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const session = require('express-session');
const db = require('./data/db'); // your SQLite helper module

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session setup
app.use(session({
  secret: 'rapidwifi-secret-key', // change to env var in production
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 2 * 60 * 60 * 1000 } // 2 hours
}));

// EJS view engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --------------------
// Hotspot Login Routes
// --------------------

// Landing page: login form
app.get('/', (req, res) => {
  if (req.session && req.session.voucher) {
    // Already logged in → redirect to success
    return res.redirect('/success');
  }
  res.render('login.ejs');
});

// Voucher login handler
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const voucher = await db.getVoucherByUsername(username);

    if (!voucher) {
      return res.status(401).render('login_result.ejs', { ok: false, error: 'Invalid username' });
    }

    if (voucher.password !== password) {
      return res.status(401).render('login_result.ejs', { ok: false, error: 'Incorrect password' });
    }

    if (voucher.status !== 'active') {
      return res.status(403).render('login_result.ejs', { ok: false, error: 'Voucher not active' });
    }

    // Successful login → store session
    req.session.voucher = {
      username: voucher.username,
      profile: voucher.profile,
      id: voucher.id
    };

    return res.redirect('/success');
  } catch (err) {
    console.error(err);
    return res.status(500).render('login_result.ejs', { ok: false, error: 'Server error' });
  }
});

// Success page
app.get('/success', (req, res) => {
  if (!req.session || !req.session.voucher) {
    return res.redirect('/');
  }
  res.render('login_result.ejs', { ok: true, message: 'Login successful! You are now connected.' });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// --------------------
// Admin Dashboard Route
// --------------------

app.get('/admin', async (req, res) => {
  try {
    const vouchers = await db.getRecentVouchers();

    // Read tunnel URL from file
    let tunnelUrl = '';
    try {
      tunnelUrl = fs.readFileSync(path.join(__dirname, 'data', 'tunnel_url.txt'), 'utf8').trim();
    } catch (err) {
      console.warn('Tunnel URL file not found');
    }

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

