const express = require('express');
const router = express.Router();

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

// --- Login route ---
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_USER && password === ADMIN_PASS) {
    req.session.user = { id: 'admin', email: ADMIN_USER, role: 'ADMIN' };
    return res.redirect('/admin');
  }

  res.render('login', { error: 'Invalid credentials' });
});

// --- Logout route ---
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// --- Debug session route ---
router.get('/debug/session', (req, res) => {
  res.json({ session: req.session });
});

module.exports = router;

