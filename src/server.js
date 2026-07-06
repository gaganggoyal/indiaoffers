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
