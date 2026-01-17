const express = require('express');
const router = express.Router();

// --- Admin credentials (from env or defaults) ---
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

// --- Middleware ---
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// --- Login route ---
router.post('/login', async (req, res) => {
  try {
    console.log('[LOGIN ATTEMPT]', req.body);
    console.log('[SESSION BEFORE]', req.session);

    const { email, password } = req.body;

    if (email === ADMIN_USER && password === ADMIN_PASS) {
      req.session.user = { id: 'admin', email: ADMIN_USER, role: 'ADMIN' };
      console.log('[LOGIN SUCCESS]', req.session.user);
      return res.redirect('/admin');
    }

    console.warn('[LOGIN FAIL]', { email });
    res.render('login', { error: 'Invalid credentials' });
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    res.status(500).send('Internal Server Error');
  }
});

// --- Logout route ---
router.get('/logout', (req, res) => {
  const user = req.session?.user;
  req.session.destroy(() => {
    console.log('[LOGOUT]', user);
    res.redirect('/login');
  });
});

// --- Debug route ---
router.get('/debug/session', (req, res) => {
  res.json({ session: req.session });
});

// --- Protect admin routes ---
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    next();
  };
}

router.get('/admin/dashboard', requireAuth, requireRole('ADMIN'), (req, res) => {
  res.json({ ok: true, user: req.session.user });
});

module.exports = router;

