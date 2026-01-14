// modules/auth/app-auth.js
const express = require('express');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // used only for future expansion; not required if you stick to sessions
const cookieParser = require('cookie-parser'); // needed for CSRF cookie mode
const csurf = require('csurf');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
require('winston-syslog');

// --- Router instance ---
const router = express.Router();

// --- Config & env ---
const APP_ENV = process.env.APP_ENV || 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';
const BCRYPT_COST = Number(process.env.BCRYPT_COST || 12);
const SYSLOG_HOST = process.env.SYSLOG_HOST || '192.168.88.2';

// Existing admin credentials (keeps current behavior)
/**
 * IMPORTANT:
 * - ADMIN_USER: string username (e.g., "admin")
 * - ADMIN_PASS: plaintext password currently used in server.js
 * We will verify with bcrypt if you later store a hash; for now, we compare safely.
 */
const ADMIN_USER = (process.env.ADMIN_USER || 'admin').trim();
const ADMIN_PASS = (process.env.ADMIN_PASS || '').trim();

// --- Logger to syslog ---
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
  } catch (e) { /* avoid throwing from logger */ }
};

// --- Security headers ---
router.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'"],
      "img-src": ["'self'"]
    }
  },
  hsts: true,
  noSniff: true,
  frameguard: { action: 'deny' }
}));

// --- Parsers & cookies (needed for CSRF cookie mode) ---
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
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20
});

// --- CSRF (cookie-based) ---
const csrfProtection = csurf({ cookie: true });

// --- RBAC & auth helpers (session-based) ---
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

// --- Admin bootstrap: verify against env admin ---
// If in the future you store a bcrypt hash in ADMIN_PASS_HASH, we’ll prefer verifying against that.
async function verifyAdminCredentials(email, password) {
  const candidate = (email || '').trim();
  const pass = (password || '').trim();

  if (!candidate || !pass) return false;
  if (candidate !== ADMIN_USER) return false;

  const ADMIN_PASS_HASH = (process.env.ADMIN_PASS_HASH || '').trim();
  if (ADMIN_PASS_HASH) {
    // Verify bcrypt hash first, if provided
    try {
      const ok = await bcrypt.compare(pass, ADMIN_PASS_HASH);
      return ok;
    } catch {
      return false;
    }
  }
  // Fallback: compare plaintext against ADMIN_PASS (current behavior)
  return ADMIN_PASS && pass === ADMIN_PASS;
}

// --- Public: obtain CSRF token for admin forms under this router ---
router.get('/admin/csrf-token', requireAuth, csrfProtection, (req, res) => {
  return res.json({ ok: true, csrfToken: req.csrfToken() });
});

// --- Login (JSON body: { email, password }) ---
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // For now, we support ADMIN only (matching current behavior)
  const ok = await verifyAdminCredentials(email, password);
  if (!ok) {
    // Count & lockout could be added here later if needed
    logAuth('login.fail', { email, ip });
    return res.status(401).json({ ok: false, error: 'invalid_credentials' });
  }

  // Establish session (aligns with your existing session-based protection)
  req.session.user = { id: 'admin', email: ADMIN_USER, role: 'ADMIN' };
  logAuth('login.success', { email: ADMIN_USER, ip });

  return res.json({ ok: true, user: { email: ADMIN_USER, role: 'ADMIN' } });
});

// --- Logout ---
router.post('/logout', requireAuth, (req, res) => {
  const user = req.session.user;
  req.session.destroy(() => {
    logAuth('logout', { email: user && user.email });
    res.json({ ok: true });
  });
});

// --- Example protected admin endpoints (mirror your current /admin, but under /authv2/admin) ---
router.use('/admin', requireAuth, csrfProtection);

// Minimal test endpoints to confirm wiring
router.get('/admin/dashboard', requireRole('ADMIN', 'OPERATOR'), (req, res) => {
  return res.json({ ok: true, message: 'authv2 dashboard reachable', user: req.session.user });
});

router.post('/admin/vouchers/create', requireRole('ADMIN', 'OPERATOR'), (req, res) => {
  // Integrate with your voucherManager here later if needed
  return res.json({ ok: true, message: 'voucher creation stub' });
});

// --- Password reset stubs (safe, rate-limited) ---
router.post('/reset/request', resetLimiter, (req, res) => {
  // Implement secure token issuance (single-use) if/when you add email or admin-issued codes
  return res.json({ ok: true });
});
router.post('/reset/confirm', resetLimiter, async (req, res) => {
  // Implement token verification + bcrypt rehash storage (ADMIN_PASS_HASH) if/when enabled
  return res.json({ ok: true });
});

// --- Export router ---
module.exports = router;

