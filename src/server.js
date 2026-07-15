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

  // Rolling deal refresh (replaces the old expire sweep): deals never retire on
  // their own. Each day we keep every live deal fresh instead —
  //   • expiry_date is rolled forward to a few days out (only when it would
  //     otherwise be sooner than that window), so it always reads a future
  //     "Expires …" date and the deal never drops out of listings/sitemap;
  //   • verified_at / updated_at are re-stamped to now, so the "✅ Verified"
  //     chip stays lit and the deal page reads "Last verified today".
  // Any deal previously auto-expired (a past expiry_date) is revived by the same
  // pass. To retire a deal for good, delete it or clear its expiry date in admin
  // — a blank/NULL expiry is never rolled forward or revived.
  // Runs at boot, then daily. Window override: DEAL_REFRESH_WINDOW_DAYS.
  // MySQL's expiry_date is a real DATE and rejects the '' literal under strict
  // mode; the empty-string guards are only needed for SQLite (TEXT column).
  const REFRESH_WINDOW_DAYS = parseInt(process.env.DEAL_REFRESH_WINDOW_DAYS || '7', 10);
  const emptyOrCase = db.driver === 'mysql' ? '' : `expiry_date = '' OR `;
  const notEmpty    = db.driver === 'mysql' ? '' : ` AND expiry_date != ''`;
  const refreshDeals = () => {
    const future = db.futureDate(REFRESH_WINDOW_DAYS);
    return db.query(
      `UPDATE deals
          SET is_active   = 1,
              verified_at = ?,
              updated_at  = ?,
              expiry_date = CASE WHEN expiry_date IS NULL OR ${emptyOrCase}expiry_date < ?
                                 THEN ? ELSE expiry_date END
        WHERE is_active = 1
           OR (expiry_date IS NOT NULL${notEmpty} AND expiry_date < ?)`,
      [db.nowSql(), db.nowSql(), future, future, db.today()])
      .then(r => { if (r && r.affectedRows) console.log(`[deals] refresh: ${r.affectedRows} deal(s) rolled forward (expiry → ${future})`); })
      .catch(e => console.error('[deals] refresh failed:', e.message));
  };
  setTimeout(refreshDeals, 5000);
  setInterval(refreshDeals, 24 * 60 * 60 * 1000).unref();

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
