'use strict';

const app = require('./app');
const config = require('./config');
const db = require('./db');

app.listen(config.port, () => {
  console.log(`
  ┌─────────────────────────────────────────┐
  │  IndiaOffers.in v2 — savings platform   │
  │  http://localhost:${config.port}                   │
  │  env: ${(process.env.NODE_ENV || 'development').padEnd(12)} db: ${db.driver.padEnd(10)}   │
  └─────────────────────────────────────────┘`);

  // Expired-deal sweep: deals past their expiry date drop out of listings and
  // the sitemap automatically (their pages stay live with an "expired" notice
  // and fresh alternatives — see the /deal/:slug route). Runs at boot, then daily.
  // MySQL's expiry_date is a real DATE and rejects the '' literal under strict
  // mode; the empty-string guard is only needed for SQLite (TEXT column).
  const notEmpty = db.driver === 'mysql' ? '' : ` AND expiry_date != ''`;
  const sweepExpired = () =>
    db.query(`UPDATE deals SET is_active = 0 WHERE is_active = 1 AND expiry_date IS NOT NULL${notEmpty} AND expiry_date < ?`, [db.today()])
      .then(r => { if (r && r.affectedRows) console.log(`[deals] expired sweep: ${r.affectedRows} deal(s) retired`); })
      .catch(e => console.error('[deals] expired sweep failed:', e.message));
  setTimeout(sweepExpired, 5000);
  setInterval(sweepExpired, 24 * 60 * 60 * 1000).unref();

  // Optional background alert delivery. Off by default; enable with
  // ALERTS_AUTO_SEND=1 (interval via ALERTS_SEND_INTERVAL_MIN, default 5 min).
  if (config.alerts.autoSend) {
    const { deliverPendingAlerts } = require('./services/alertSender');
    const run = () => deliverPendingAlerts()
      .then(r => { if (r.attempted) console.log(`[alerts] auto-send: ${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed (${r.mode})`); })
      .catch(e => console.error('[alerts] auto-send failed:', e.message));
    const ms = config.alerts.intervalMin * 60 * 1000;
    console.log(`  ↳ alert auto-send ON — every ${config.alerts.intervalMin} min`);
    setTimeout(run, 15000);          // first pass shortly after boot
    setInterval(run, ms).unref();    // don't keep the process alive just for this
  }
});
