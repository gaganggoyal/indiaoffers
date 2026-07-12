'use strict';

/**
 * Offline backup — everything needed to rebuild the site that is NOT in git:
 * a portable SQL data dump (restores into MySQL or SQLite) plus a README with
 * restore steps. The admin route tars these together with public/uploads/.
 *
 * .env is deliberately excluded: a backup file that leaves the server should
 * never carry JWT_SECRET / DB_PASSWORD / SMTP creds. The README lists which
 * variables must be re-entered on a fresh deploy.
 */

const db = require('../db');

// Backtick-quoting is valid in both MySQL and SQLite.
const ident = name => '`' + String(name).replace(/`/g, '') + '`';

function sqlValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'bigint') return v.toString();
  if (Buffer.isBuffer(v)) return "X'" + v.toString('hex') + "'";
  if (v instanceof Date) return "'" + v.toISOString().slice(0, 19).replace('T', ' ') + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

async function listTables() {
  if (db.driver === 'mysql') {
    const rows = await db.query('SHOW TABLES');
    return rows.map(r => String(Object.values(r)[0])).sort();
  }
  const rows = await db.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  return rows.map(r => r.name);
}

// Tables sorted parents-before-children, so the dump restores cleanly even with
// foreign keys enforced (SQLite has no equivalent of SET FOREIGN_KEY_CHECKS=0
// that MySQL would also accept). Deletes run in the reverse of this order.
async function tableOrder() {
  const tables = await listTables();
  const parents = {};
  for (const t of tables) {
    const rows = db.driver === 'mysql'
      ? await db.query(
          `SELECT DISTINCT REFERENCED_TABLE_NAME p FROM information_schema.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`, [t])
      : (await db.query(`PRAGMA foreign_key_list(${ident(t)})`)).map(r => ({ p: r.table }));
    parents[t] = [...new Set(rows.map(r => r.p))].filter(p => p !== t && tables.includes(p));
  }
  const order = [], seen = new Set();
  const visit = t => {
    if (seen.has(t)) return;
    seen.add(t);
    parents[t].forEach(visit);
    order.push(t);
  };
  tables.forEach(visit);
  return order;
}

// Data-only dump. Strings are escaped by doubling quotes; NO_BACKSLASH_ESCAPES
// makes that safe for MySQL too. The /*! ... */ directives run on MySQL but are
// plain comments to SQLite, so one file restores into either driver.
async function sqlDump() {
  const tables = await tableOrder();
  const out = [
    `-- IndiaOffers.in data dump — generated ${new Date().toISOString()} (driver: ${db.driver})`,
    '-- Data only: apply the schema from the git repo first, then run this file (see README.md).',
    "/*!40101 SET SESSION sql_mode = 'NO_BACKSLASH_ESCAPES' */;",
    '/*!40014 SET FOREIGN_KEY_CHECKS = 0 */;',
    ''
  ];
  // Empty children before parents, then refill parents before children.
  for (const t of [...tables].reverse()) out.push(`DELETE FROM ${ident(t)};`);
  for (const t of tables) {
    const rows = await db.query(`SELECT * FROM ${ident(t)}`);
    out.push('', `-- ${t}: ${rows.length} rows`);
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    const colSql = cols.map(ident).join(', ');
    for (let i = 0; i < rows.length; i += 100) {
      const values = rows.slice(i, i + 100)
        .map(r => '(' + cols.map(c => sqlValue(r[c])).join(', ') + ')')
        .join(',\n');
      out.push(`INSERT INTO ${ident(t)} (${colSql}) VALUES\n${values};`);
    }
  }
  out.push('', '/*!40014 SET FOREIGN_KEY_CHECKS = 1 */;', '');
  return out.join('\n');
}

function readmeText() {
  return `# IndiaOffers.in — offline backup

Created ${new Date().toISOString()} from the live site (${db.driver} database).

This archive plus the GitHub repo is everything needed to rebuild the site.

## Contents

- \`dump.sql\`  — full data dump of every table (data only; the schema lives in the repo)
- \`uploads/\` — every image uploaded through the admin panel (served at /uploads/...)

## Restore

1. Clone the repo and follow DEPLOY.md (npm ci, .env, systemd/nginx).
   **.env is not in this backup** — secrets must be re-entered on the new machine:
   JWT_SECRET (regenerate: \`openssl rand -hex 32\`), DB_PASSWORD, SMTP_*,
   GEMINI_API_KEY. See .env.example / DEPLOY.md for the full list.
2. Copy \`uploads/\` into \`public/uploads/\` in the checkout.
3. Load the data (dump.sql replaces all rows, including admin logins):
   - MySQL:  \`mysql -h HOST -u USER -p DBNAME < src/db/schema.mysql.sql\`
             then \`mysql -h HOST -u USER -p DBNAME < dump.sql\`
   - SQLite: start the app once so the schema auto-applies, stop it,
             then \`sqlite3 data/indiaoffers.db < dump.sql\`
4. Start the app and log in with the same admin credentials as before.
`;
}

module.exports = { sqlDump, readmeText };
