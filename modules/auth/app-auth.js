router.post('/login', loginLimiter, csrfProtection, async (req, res) => {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const ok = await verifyAdminCredentials(email, password);
  if (!ok) {
    logAuth('login.fail', { email, ip });

    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      return res.render('login', {
        error: 'Invalid credentials',
        __: res.__,
        csrfToken: req.csrfToken()
      });
    }

    return res.status(401).json({ ok: false, error: 'invalid_credentials' });
  }

  req.session.user = { id: 'admin', email: ADMIN_USER, role: 'ADMIN' };
  logAuth('login.success', { email: ADMIN_USER, ip });

  if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
    return res.redirect('/admin');
  }

  return res.json({ ok: true, user: { email: ADMIN_USER, role: 'ADMIN' } });
});

