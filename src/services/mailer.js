'use strict';

/**
 * Email transport for user alerts.
 *
 * Two modes, chosen automatically from config:
 *   • "smtp" — SMTP_HOST is set → real delivery via nodemailer.
 *   • "log"  — no SMTP configured → emails are printed to the server log instead
 *              of being sent, so the whole alert pipeline works in development
 *              without any credentials. Nothing silently disappears.
 *
 * The transporter is created lazily and cached, and nodemailer is only required
 * when SMTP is actually configured, so the app boots fine even if the dependency
 * is missing in a log-only environment.
 */

const config = require('../config');

let transporter = null;

function mailerMode() {
  return config.mail.host ? 'smtp' : 'log';
}

function getTransport() {
  if (transporter) return transporter;
  const nodemailer = require('nodemailer');
  const m = config.mail;
  transporter = nodemailer.createTransport({
    host: m.host, port: m.port, secure: m.secure,
    auth: m.user ? { user: m.user, pass: m.pass } : undefined
  });
  return transporter;
}

/**
 * Send one email.
 * @returns {Promise<{ok:boolean, id?:string, mode:string, error?:string}>}
 */
async function sendMail({ to, subject, html, text }) {
  if (!to) return { ok: false, mode: mailerMode(), error: 'no recipient address' };

  if (mailerMode() === 'log') {
    console.log(`\n[mailer:log] would email → ${to}\n  subject: ${subject}\n  ${(text || '').split('\n').join('\n  ')}\n`);
    return { ok: true, id: 'logged', mode: 'log' };
  }
  try {
    const info = await getTransport().sendMail({ from: config.mail.from, to, subject, html, text });
    return { ok: true, id: info.messageId, mode: 'smtp' };
  } catch (err) {
    return { ok: false, mode: 'smtp', error: err.message };
  }
}

/** Verify the SMTP connection (used by the admin "test" button). No-op in log mode. */
async function verifyTransport() {
  if (mailerMode() === 'log') return { ok: true, mode: 'log', note: 'log mode — emails are printed, not sent' };
  try { await getTransport().verify(); return { ok: true, mode: 'smtp' }; }
  catch (err) { return { ok: false, mode: 'smtp', error: err.message }; }
}

module.exports = { sendMail, verifyTransport, mailerMode };
