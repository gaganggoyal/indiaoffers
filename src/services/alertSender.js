'use strict';

/**
 * Alert delivery worker.
 *
 * Reads pending (is_sent = 0) alerts for active users, groups them per user, and
 * sends one tidy email per user via the mailer. Rows are marked sent (with a
 * sent_at timestamp) only after their email succeeds, so a failed send stays
 * pending and is retried on the next run — no alert is lost or double-counted.
 *
 * Triggered manually from the admin Alerts page and, optionally, on a timer
 * (ALERTS_AUTO_SEND) from the server bootstrap.
 */

const db = require('../db');
const config = require('../config');
const { sendMail, mailerMode } = require('./mailer');

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const absUrl = link => {
  const l = String(link || '');
  if (!l) return config.siteUrl;
  return /^https?:\/\//i.test(l) ? l : config.siteUrl.replace(/\/$/, '') + (l.startsWith('/') ? l : '/' + l);
};

// Build the per-user email (subject + html + text) from their pending alerts.
function buildEmail(username, rows) {
  const n = rows.length;
  const subject = n === 1 ? rows[0].title : `You have ${n} new offers on IndiaOffers`;

  const items = rows.map(a => {
    const url = absUrl(a.link_url);
    return `
      <tr><td style="padding:12px 0;border-bottom:1px solid #eef2f7">
        <div style="font-weight:700;color:#0c2b55;font-size:15px">${esc(a.title)}</div>
        ${a.body ? `<div style="color:#475569;font-size:13px;margin-top:3px">${esc(a.body)}</div>` : ''}
        <a href="${esc(url)}" style="display:inline-block;margin-top:8px;color:#2563eb;font-size:13px;font-weight:600">View offer →</a>
      </td></tr>`;
  }).join('');

  const html = `
  <div style="max-width:560px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <div style="background:#0c2b55;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:800;font-size:18px">IndiaOffers</div>
    <div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:8px 20px 20px">
      <p style="color:#0c2b55;font-size:15px">Hi ${esc(username || 'there')}, here ${n === 1 ? 'is a new offer' : `are ${n} new offers`} for you:</p>
      <table style="width:100%;border-collapse:collapse">${items}</table>
      <p style="color:#94a3b8;font-size:11px;margin-top:18px">You're getting this because you set up alerts on IndiaOffers.in.</p>
    </div>
  </div>`;

  const text = `Hi ${username || 'there'}, ${n === 1 ? 'a new offer' : n + ' new offers'} on IndiaOffers:\n\n` +
    rows.map(a => `• ${a.title}${a.body ? ' — ' + a.body : ''}\n  ${absUrl(a.link_url)}`).join('\n\n');

  return { subject, html, text };
}

/**
 * Deliver pending alerts.
 * @param {object} [opts]
 * @param {number} [opts.limit=500] max alert rows to pull in one run
 * @returns {Promise<{mode,users,attempted,sent,failed,skipped,errors:string[]}>}
 */
async function deliverPendingAlerts({ limit = 500 } = {}) {
  const rows = await db.query(
    `SELECT a.id, a.user_id, a.title, a.body, a.link_url, u.email, u.username
       FROM alerts a JOIN users u ON u.id = a.user_id
      WHERE a.is_sent = 0 AND u.is_active = 1
      ORDER BY a.user_id, a.created_at
      LIMIT ?`,
    [limit]
  );

  const res = { mode: mailerMode(), users: 0, attempted: rows.length, sent: 0, failed: 0, skipped: 0, errors: [] };
  if (rows.length === 0) return res;

  // Group by user.
  const byUser = new Map();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id).push(r);
  }

  for (const [, group] of byUser) {
    const u = group[0];
    if (!u.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email)) {
      res.skipped += group.length;                     // no usable address → leave pending
      continue;
    }
    res.users++;
    const { subject, html, text } = buildEmail(u.username, group);
    const r = await sendMail({ to: u.email, subject, html, text });
    if (r.ok) {
      const ids = group.map(g => g.id);
      await db.query(
        `UPDATE alerts SET is_sent = 1, sent_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
        [db.nowSql(), ...ids]
      );
      res.sent += ids.length;
    } else {
      res.failed += group.length;
      res.errors.push(`${u.email}: ${r.error || 'send failed'}`);
    }
  }
  return res;
}

module.exports = { deliverPendingAlerts, buildEmail };
