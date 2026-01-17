// modules/auth/app-auth.js
const express = require('express');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
require('winston-syslog');

const router = express.Router();   // ✅ critical line

// --- Config & env ---
const BCRYPT_COST = Number(process.env.BCRYPT_COST || 12);
const SYSLOG_HOST = process.env.SYSLOG_HOST || '192.168.88.2';

const ADMIN_USER = (process.env.ADMIN_USER || 'admin').trim();
const ADMIN_PASS = (process.env.ADMIN_PASS || '').trim();
const ADMIN_PASS_HASH = (process.env.ADMIN_PASS_HASH || '').trim();

// --- Logger ---
const logger = winston.createLogger({
  transports: [
    new winston.transports.Syslog({
      host: SYSLOG_HOST,
      app_name: 'rapidwifi-dashboard',
      protocol: 'udp4'
    })
  ]
});
const logAuth = (event, details) => {
  try {
    logger.info(`[AUTH] ${event} ${JSON.stringify(details)}`);
  } catch {}
};

// --- Security headers ---
router.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'"],
      "img-src": ["'self'"],
      "font-src": ["'self'", "https://fonts.gstatic.com"] // ✅ allow fonts
    }
  },
  hsts: true,
  noSniff: true,
  frameguard: { action: 'deny' }
}));

// --- Parsers & cookies ---
router.use(express.json());
router.use(express.urlencoded({ extended: false }));
router.use(cookieParser());

// --- Rate limiting ---
const loginLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 50),
  standardHeaders: true,
  legacyHeaders: false
});
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// --- CSRF ---
const csrfProtection = csurf({ cookie: true });

// --- Auth helpers ---
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    next();
  };
}

// --- Verify admin credentials ---
async function verifyAdminCredentials(email, password) {
  if (email !== ADMIN_USER) return false;
  if (ADMIN_PASS_HASH) {
    try {
      return await bcrypt.compare(password, ADMIN_PASS_HASH);
    } catch {
      return false;
    }
  }
  return ADMIN_PASS && password === ADMIN_PASS;
}

// --- Routes ---
router.get('/admin/csrf-token', requireAuth, csrfProtection, (req, res) => {
  res.json({ ok: true, csrfToken: req.csrfToken() });
});

// --- Admin UI route ---
router.get('/admin', requireAuth, requireRole('ADMIN'), csrfProtection, (req, res) => {
  res.render('admin', {
    user: req.session.user,
    __: res.__,
    csrfToken: req.csrfToken()
  });
});

// --- Login route (form + JSON) ---
router.post('/login', loginLimiter, csrfProtection, async (req, res) => {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const ok = await verifyAdminCredentials(email, password);
  if (!ok) {
    logAuth('login.fail', { email, ip });
    return res.render('login', {
      error: 'Invalid credentials',
      __: res.__,
      csrfToken: req.csrfToken()
    });
  }

  req.session.user = { id: 'admin', email: ADMIN_USER, role: 'ADMIN' };
  logAuth('login.success', { email: ADMIN_USER, ip });

  // ✅ Explicit separation: browser vs API
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    // API client
    return res.json({ ok: true, user: { email: ADMIN_USER, role: 'ADMIN' } });
  } else {
    // Browser form
    return res.redirect('/admin');
  }
});

// --- Logout ---
router.post('/logout', requireAuth, (req, res) => {
  const user = req.session.user;
  req.session.destroy(() => {
    logAuth('logout', { email: user && user.email });
    res.json({ ok: true });
  });
});

// Example protected route
router.use('/admin', requireAuth, csrfProtection);
router.get('/admin/dashboard', requireRole('ADMIN'), (req, res) => {
  res.json({ ok: true, message: 'authv2 dashboard reachable', user: req.session.user });
});

// --- Debug route to verify session ---
router.get('/debug/session', (req, res) => {
  res.json({ session: req.session });
});

// Password reset stubs
router.post('/reset/request', resetLimiter, (req, res) => {
  res.json({ ok: true });
});
router.post('/reset/confirm', resetLimiter, async (req, res) => {
  res.json({ ok: true });
});

module.exports = {
  router,
  requireAuth,
  requireRole
};

