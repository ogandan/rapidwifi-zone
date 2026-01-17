const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./data/db');
const { Parser } = require('json2csv');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'rapidwifi-secret',
  resave: false,
  saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --------------------
// Login Routes
// --------------------

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/success');
  }
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const voucher = await db.getVoucherByUsername(username);
    if (!voucher) {
      return res.render('login_result', { success: false, message: 'Invalid username' });
    }
    if (voucher.password !== password) {
      return res.render('login_result', { success: false, message: 'Incorrect password' });
    }
    if (voucher.status !== 'active') {
      return res.render('login_result', { success: false, message: 'Voucher not active' });
    }

    req.session.user = voucher.username;
    res.render('login_result', { success: true, message: 'Login successful! You are now connected.' });
  } catch (err) {
    console.error(err);
    res.render('login_result', { success: false, message: 'Server error' });
  }
});

app.get('/success', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  res.render('login_result', { success: true, message: 'Login successful! You are now connected.' });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// --------------------
// Admin Dashboard
// --------------------

app.get('/admin', async (req, res) => {
  try {
    const vouchers = await db.getRecentVouchers(50);
    const tunnelUrl = db.getTunnelUrl();
    res.render('admin', { vouchers, tunnelUrl });
  } catch (err) {
    console.error(err);
    res.send('Error loading admin dashboard');
  }
});

app.post('/admin/create', async (req, res) => {
  const { profile } = req.body;
  try {
    await db.createVoucher(profile);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error creating voucher');
  }
});

app.post('/admin/block/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.blockVoucher(id);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error blocking voucher');
  }
});

app.post('/admin/delete/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.deleteVoucher(id);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error deleting voucher');
  }
});

// --------------------
// Export Vouchers
// --------------------

app.get('/admin/export', async (req, res) => {
  try {
    const vouchers = await db.getAllVouchers();
    const fields = ['id', 'username', 'password', 'profile', 'status', 'created_at'];
    const parser = new Parser({ fields });
    const csv = parser.parse(vouchers);

    res.header('Content-Type', 'text/csv');
    res.attachment('vouchers.csv');
    return res.send(csv);
  } catch (err) {
    console.error(err);
    res.send('Error exporting vouchers');
  }
});

app.post('/admin/export-range', async (req, res) => {
  const { startDate, endDate } = req.body;
  try {
    const vouchers = await db.getVouchersByDateRange(startDate, endDate);
    const fields = ['id', 'username', 'password', 'profile', 'status', 'created_at'];
    const parser = new Parser({ fields });
    const csv = parser.parse(vouchers);

    res.header('Content-Type', 'text/csv');
    res.attachment(`vouchers_${startDate}_to_${endDate}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error(err);
    res.send('Error exporting vouchers by date range');
  }
});

app.post('/admin/export-profile', async (req, res) => {
  const { profile } = req.body;
  try {
    const vouchers = await db.getVouchersByProfile(profile);
    const fields = ['id', 'username', 'password', 'profile', 'status', 'created_at'];
    const parser = new Parser({ fields });
    const csv = parser.parse(vouchers);

    res.header('Content-Type', 'text/csv');
    res.attachment(`vouchers_${profile}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error(err);
    res.send('Error exporting vouchers by profile');
  }
});

// --------------------
// Start Server
// --------------------

app.listen(PORT, () => {
  console.log(`Server running on http://192.168.88.2:${PORT}`);
});

