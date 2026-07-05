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

module.exports = { adminAuth, signAdmin };
