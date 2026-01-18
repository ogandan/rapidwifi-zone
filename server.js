// ===== server.js Part 1 =====
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./data/db');
const { Parser } = require('json2csv');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'rapidwifi-secret',
  resave: false,
  saveUninitialized: true
}));

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
// Login Routes
// --------------------
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/success');
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const voucher = await db.getVoucherByUsername(username);
    if (!voucher) return res.render('login_result', { success: false, message: 'Invalid username' });
    if (voucher.password !== password) return res.render('login_result', { success: false, message: 'Incorrect password' });
    if (voucher.status !== 'active') return res.render('login_result', { success: false, message: 'Voucher not active' });

    req.session.user = voucher.username;
    res.render('login_result', { success: true, message: 'Login successful! You are now connected.' });
  } catch (err) {
    console.error(err);
    res.render('login_result', { success: false, message: 'Server error' });
  }
});

app.get('/success', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.render('login_result', { success: true, message: 'Login successful! You are now connected.' });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
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
  const { profile, batchTag } = req.body;
  try {
    await db.createVoucher(profile, batchTag);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error creating voucher');
  }
});

app.post('/admin/block/:id', async (req, res) => {
  try {
    await db.blockVoucher(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error blocking voucher');
  }
});

app.post('/admin/delete/:id', async (req, res) => {
  try {
    await db.deleteVoucher(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Error deleting voucher');
  }
});
// ===== server.js Part 2 =====

// --------------------
// Voucher Export Routes
// --------------------
app.get('/admin/export', async (req, res) => {
  try {
    const vouchers = await db.getAllVouchers();
    await db.logDownload('export-all', 'vouchers.csv', 'admin');
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
    res.send('Error exporting vouchers');
  }
});

// (other export routes unchanged: export-range, export-profile, export-batch)

// --------------------
// Bulk Action Route
// --------------------
app.post('/admin/bulk-action', async (req, res) => {
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

// --------------------
// Logs Page & Export
// --------------------
app.get('/admin/logs', async (req, res) => {
  try {
    let { action, user, filename, startDate, endDate, sort, order, page } = req.query;
    let logs = await db.getDownloadLogs(500);

    if (action) logs = logs.filter(l => l.action.toLowerCase().includes(action.toLowerCase()));
    if (user) logs = logs.filter(l => l.user.toLowerCase().includes(user.toLowerCase()));
    if (filename) logs = logs.filter(l => l.filename.toLowerCase().includes(filename.toLowerCase()));
    if (startDate && endDate) {
      logs = logs.filter(l => new Date(l.timestamp) >= new Date(startDate) && new Date(l.timestamp) <= new Date(endDate));
    }

    if (sort) {
      logs.sort((a, b) => {
        let valA = a[sort], valB = b[sort];
        if (sort === 'timestamp') {
          valA = new Date(valA); valB = new Date(valB);
        }
        if (valA < valB) return order === 'desc' ? 1 : -1;
        if (valA > valB) return order === 'desc' ? -1 : 1;
        return 0;
      });
    }

    const pageSize = 50;
    const currentPage = parseInt(page) || 1;
    const totalPages = Math.ceil(logs.length / pageSize);
    const paginatedLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    res.render('logs', { logs: paginatedLogs, totalPages, currentPage, query: req.query });
  } catch (err) {
    console.error(err);
    res.send('Error loading logs');
  }
});

app.get('/admin/export-logs', async (req, res) => {
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

app.get('/admin/export-logs-json', async (req, res) => {
  try {
    let logs = await db.getDownloadLogs(500);
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.send('Error exporting logs as JSON');
  }
});

// --------------------
// Analytics Page Route
// --------------------
app.get('/analytics', (req, res) => {
  res.render('analytics');
});
// ===== server.js Part 3 =====

// Stats Endpoint (existing summary stats)
app.get('/admin/stats', async (req, res) => {
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
      total: 0, active: 0, inactive: 0, exportsToday: 0,
      profiles: {}, exportsByProfile: {}, creation: { labels: [], values: [] }
    });
  }
});

// NEW: Daily voucher creation
app.get('/admin/stats-daily', async (req, res) => {
  try {
    const daily = await db.voucherCreationDaily();
    res.json(daily);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// NEW: Weekly voucher creation
app.get('/admin/stats-weekly', async (req, res) => {
  try {
    const weekly = await db.voucherCreationWeekly();
    res.json(weekly);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// NEW: Profile performance (creation vs exports)
app.get('/admin/stats-profile-performance', async (req, res) => {
  try {
    const perf = await db.profilePerformance();
    res.json(perf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// NEW: Export behavior insights
app.get('/admin/stats-export-behavior', async (req, res) => {
  try {
    const insights = await db.exportBehaviorInsights();
    res.json(insights);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// Start Server
// --------------------
app.listen(PORT, () => {
  console.log(`Server running on http://192.168.88.2:${PORT}`);
});

