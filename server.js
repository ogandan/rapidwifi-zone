const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Sessions ---
app.use(session({
  secret: process.env.SESSION_SECRET || 'rapidwifi-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// --- Middleware ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Mount auth router ---
const authV2 = require('./modules/auth/app-auth.js');
app.use('/authv2', authV2);

// --- Admin dashboard ---
const adminDashboard = require('./modules/adminDashboard');
app.use('/admin', (req, res, next) => {
  if (req.session && req.session.user) return next();
  res.redirect('/login');
}, adminDashboard);

// --- Login page ---
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.listen(PORT, () => {
  console.log(`RAPIDWIFI-ZONE running on port ${PORT}`);
});

