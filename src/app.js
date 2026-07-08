'use strict';

const express = require('express');
const path = require('path');
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
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: config.isProd ? '7d' : 0 }));

// Locals available to every template
app.use((req, res, next) => {
  res.locals.siteName = config.siteName;
  res.locals.siteUrl = config.siteUrl;
  res.locals.path = req.path;
  res.locals.fmt = n => n == null ? '' : '₹' + Number(n).toLocaleString('en-IN');
  // Render admin-pasted text keeping its format: escape HTML, blank line => paragraph, single newline => <br>
  res.locals.richText = s => {
    if (!s) return '';
    const esc = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.trim().split(/\r?\n\s*\r?\n/).map(b => '<p>' + b.replace(/\r?\n/g, '<br>') + '</p>').join('');
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
