'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

/** Admin session lives in an httpOnly cookie (SSR-friendly). */
function adminAuth(req, res, next) {
  const token = req.cookies && req.cookies.io_admin;
  if (!token) return res.redirect('/admin/login');
  try {
    req.admin = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.clearCookie('io_admin');
    res.redirect('/admin/login');
  }
}

function signAdmin(admin) {
  return jwt.sign({ id: admin.id, name: admin.name, email: admin.email }, config.jwtSecret, { expiresIn: '7d' });
}

/** Populate res.locals.user (if logged in) for every page — non-blocking. */
function attachUser(req, res, next) {
  const token = req.cookies && req.cookies.io_user;
  res.locals.user = null;
  if (token) {
    try { res.locals.user = req.user = jwt.verify(token, config.jwtSecret); }
    catch { res.clearCookie('io_user'); }
  }
  next();
}

/** Require a logged-in user (for /account). */
function userAuth(req, res, next) {
  const token = req.cookies && req.cookies.io_user;
  if (!token) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    res.locals.user = req.user;
    next();
  } catch {
    res.clearCookie('io_user');
    res.redirect('/login');
  }
}

function signUser(user) {
  return jwt.sign({ id: user.id, username: user.username, email: user.email }, config.jwtSecret, { expiresIn: '30d' });
}

module.exports = { adminAuth, signAdmin, attachUser, userAuth, signUser };
