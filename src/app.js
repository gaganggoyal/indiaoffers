'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const config = require('./config');
const { attachUser } = require('./middleware/auth');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', true);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(config.isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { maxAge: config.isProd ? '7d' : 0 }));

// Cache-busting: append a local file's mtime as ?v=… so a swapped image (same filename)
// updates instantly for browsers despite the long cache. External URLs pass through unchanged.
const verCache = new Map();
function ver(u) {
  if (!u || /^(https?:)?\/\//i.test(u) || u.startsWith('data:')) return u || '';
  const clean = u.split('?')[0];
  let v = verCache.get(clean);
  if (v === undefined) {
    try { v = Math.floor(fs.statSync(path.join(publicDir, clean)).mtimeMs).toString(36); }
    catch { v = null; }
    verCache.set(clean, v);
  }
  return v ? clean + '?v=' + v : u;
}

// Locals available to every template
app.use((req, res, next) => {
  res.locals.siteName = config.siteName;
  res.locals.siteUrl = config.siteUrl;
  res.locals.path = req.path;
  res.locals.fmt = n => n == null ? '' : '₹' + Number(n).toLocaleString('en-IN');
  res.locals.ver = ver;
  // Render admin-pasted text keeping its format: escape HTML, blank line => paragraph, single newline => <br>
  res.locals.richText = s => {
    if (!s) return '';
    const esc = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.trim().split(/\r?\n\s*\r?\n/).map(b => '<p>' + b.replace(/\r?\n/g, '<br>') + '</p>').join('');
  };
  // Support channels + "WhatsApp Us" auto-link: escapes the text, then turns any
  // "WhatsApp Us" mention (as typed by the admin, e.g. in a guide's why-choose
  // field) into a wa.me link to our support number.
  res.locals.support = config.support;
  res.locals.waUrl = `https://wa.me/${config.support.whatsappDigits}`;
  res.locals.waText = s => {
    if (!s) return '';
    const esc = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.replace(/whats\s*app\s+us/gi,
      m => `<a class="wa-link" href="https://wa.me/${config.support.whatsappDigits}" target="_blank" rel="noopener">${m}</a>`);
  };
  next();
});

// Make the logged-in user (if any) available to every template
app.use(attachUser);

app.use('/', require('./routes/pages'));
app.use('/', require('./routes/account'));
app.use('/go', require('./routes/go'));
app.use('/api', require('./routes/api'));
app.use('/admin', require('./routes/admin'));

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page not found', meta: {} });
});

module.exports = app;
