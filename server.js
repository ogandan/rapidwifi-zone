// ===== server.js Part 1 =====
// File: server.js — Express server with sessions, CSRF, role-based access, vouchers, and user management

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const csrf = require('csurf');
const { Parser } = require('json2csv');

const app = express();
const PORT = 3000;
const db = new sqlite3.Database('./data/db.sqlite');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'rapidwifi-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { httpOnly: true, secure: false, maxAge: 30 * 60 * 1000 } // secure:true if HTTPS
}));
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
// Middleware Helpers
// --------------------
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.role !== 'admin') {
    return res.status(403).send('Forbidden: Admins only');
  }
  next();
}
function requireOperator(req, res, next) {
  if (!req.session.user || req.session.role !== 'operator') {
    return res.status(403).send('Forbidden: Operators only');
  }
  next();
}
// ===== server.js Part 2 =====
// Authentication, dashboards, and operator management

// --------------------
// Login Routes
// --------------------
app.get('/login', (req, res) => {
  res.render('login', { csrfToken: req.csrfToken(), message: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err || !user) return res.render('login', { csrfToken: req.csrfToken(), message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.render('login', { csrfToken: req.csrfToken(), message: 'Invalid credentials' });
    req.session.user = user.username;
    req.session.role = user.role;
    if (user.role === 'admin') return res.redirect('/admin');
    if (user.role === 'operator') return res.redirect('/operator');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// --------------------
// Admin Dashboard
// --------------------
app.get('/admin', requireLogin, requireAdmin, async (req, res) => {
  try {
    // Get vouchers
    const vouchers = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM vouchers ORDER BY created_at DESC LIMIT 50", [], (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    // Get operators
    const operators = await new Promise((resolve, reject) => {
      db.all("SELECT id, username, role FROM users WHERE role='operator'", [], (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    res.render('admin', {
      vouchers,
      operators,
      tunnelUrl: null,
      csrfToken: req.csrfToken(),
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.send('Error loading admin dashboard');
  }
});

// Operator Dashboard
app.get('/operator', requireLogin, requireOperator, async (req, res) => {
  try {
    const vouchers = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM vouchers ORDER BY created_at DESC LIMIT 50", [], (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
    res.render('operator', { vouchers, csrfToken: req.csrfToken(), session: req.session });
  } catch (err) {
    console.error(err);
    res.send('Error loading operator dashboard');
  }
});

// --------------------
// Admin: Operator Management
// --------------------
app.post('/admin/create-operator', requireLogin, requireAdmin, async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 12);
  db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'operator')",
    [username, hash], (err) => {
      if (err) {
        console.error(err);
        return res.send('Error creating operator');
      }
      res.redirect('/admin');
    });
});

app.post('/admin/delete-operator/:id', requireLogin, requireAdmin, (req, res) => {
  db.run("DELETE FROM users WHERE id = ? AND role = 'operator'", [req.params.id], (err) => {
    if (err) {
      console.error(err);
      return res.send('Error deleting operator');
    }
    res.redirect('/admin');
  });
});
// ===== server.js Part 3 =====
// Voucher management, logs, analytics, and server start

// Voucher creation
app.post('/admin/create', requireLogin, requireAdmin, async (req, res) => {
  const { profile, batchTag } = req.body;
  db.run("INSERT INTO vouchers (username, password, profile, status, batch_tag) VALUES (?, ?, ?, 'active', ?)",
    [Math.random().toString(36).substring(2, 8), Math.random().toString(36).substring(2, 8), profile, batchTag],
    (err) => {
      if (err) {
        console.error(err);
        return res.send('Error creating voucher');
      }
      res.redirect('/admin');
    });
});

// Block voucher
app.post('/admin/block/:id', requireLogin, requireAdmin, (req, res) => {
  db.run("UPDATE vouchers SET status='blocked' WHERE id=?", [req.params.id], (err) => {
    if (err) return res.send('Error blocking voucher');
    res.redirect('/admin');
  });
});

// Delete voucher
app.post('/admin/delete/:id', requireLogin, requireAdmin, (req, res) => {
  db.run("DELETE FROM vouchers WHERE id=?", [req.params.id], (err) => {
    if (err) return res.send('Error deleting voucher');
    res.redirect('/admin');
  });
});

// Logs page
app.get('/admin/logs', requireLogin, requireAdmin, (req, res) => {
  db.all("SELECT * FROM download_logs ORDER BY timestamp DESC LIMIT 500", [], (err, logs) => {
    if (err) return res.send('Error loading logs');
    res.render('logs', { logs, totalPages: 1, currentPage: 1, query: {} });
  });
});

// Analytics page
app.get('/analytics', requireLogin, requireAdmin, (req, res) => {
  res.render('analytics');
});

// Stats endpoints (simplified example)
app.get('/admin/stats', requireLogin, requireAdmin, async (req, res) => {
  db.get("SELECT COUNT(*) as total FROM vouchers", [], (err, row) => {
    if (err) return res.json({ total: 0 });
    res.json({ total: row.total });
  });
});

// --------------------
// Start Server
// --------------------
app.listen(PORT, () => {
  console.log(`Server running on http://192.168.88.2:${PORT}`);
});

