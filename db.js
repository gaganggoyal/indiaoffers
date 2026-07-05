/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  IndiaOffers.in — Database Layer
 *
 *  Two drivers behind one `query(sql, params)` interface:
 *    • sqlite (default) — zero-config, file at ./data/indiaoffers.db.
 *      Schema auto-created from schema-sqlite.sql on first run.
 *    • mysql — set DB_DRIVER=mysql (+ DB_HOST/DB_USER/DB_PASSWORD/DB_NAME
 *      in .env) and run schema.sql once. Same query interface.
 *
 *  Contract: SELECT returns an array of rows; INSERT/UPDATE/DELETE returns
 *  { affectedRows, insertId }. All SQL in this codebase is written portably
 *  (JS-computed timestamps as params); the only MySQL-isms translated for
 *  SQLite are NOW(), CURDATE() and INSERT IGNORE.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const path = require('path');
const fs   = require('fs');

const DRIVER = (process.env.DB_DRIVER || 'sqlite').toLowerCase();

let query;

if (DRIVER === 'mysql') {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host              : process.env.DB_HOST || 'localhost',
    port              : parseInt(process.env.DB_PORT || '3306', 10),
    user              : process.env.DB_USER || 'root',
    password          : process.env.DB_PASSWORD || '',
    database          : process.env.DB_NAME || 'indiaoffers',
    waitForConnections: true,
    connectionLimit   : 10,
    dateStrings       : true
  });

  query = async (sql, params = []) => {
    const [rows] = await pool.query(sql, params);
    return rows;
  };
} else {
  const Database = require('better-sqlite3');
  const dataDir  = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const sqlite = new Database(path.join(dataDir, 'indiaoffers.db'));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(fs.readFileSync(path.join(__dirname, 'schema-sqlite.sql'), 'utf8'));

  // Additive migrations for existing dev databases
  const dealCols = sqlite.prepare("SELECT name FROM pragma_table_info('deals')").all().map(c => c.name);
  for (const [col, type] of [['original_price','REAL'],['deal_price','REAL'],['deal_url','TEXT'],['how_to_get','TEXT']]) {
    if (!dealCols.includes(col)) sqlite.exec(`ALTER TABLE deals ADD COLUMN ${col} ${type}`);
  }

  const toSqlite = sql => sql
    .replace(/INSERT\s+IGNORE/gi, 'INSERT OR IGNORE')
    .replace(/\bNOW\(\)/gi, "datetime('now')")
    .replace(/\bCURDATE\(\)/gi, "date('now')");

  query = async (sql, params = []) => {
    const stmt = sqlite.prepare(toSqlite(sql));
    const bound = params.map(p => (p === undefined ? null : p));
    if (stmt.reader) return stmt.all(...bound);
    const info = stmt.run(...bound);
    return { affectedRows: info.changes, insertId: Number(info.lastInsertRowid) };
  };
}

module.exports = { query, driver: DRIVER };
