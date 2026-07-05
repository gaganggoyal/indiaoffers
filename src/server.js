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
});
