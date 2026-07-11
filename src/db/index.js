'use strict';

/**
 * Database layer — one `query(sql, params)` interface over two drivers:
 *   sqlite (default): zero-config file at ./data/indiaoffers.db, schema auto-applied
 *   mysql:            DB_DRIVER=mysql + DB_* env vars, run schema.mysql.sql once
 *
 * Contract: SELECT → array of rows; INSERT/UPDATE/DELETE → { affectedRows, insertId }.
 * All application SQL is portable; only NOW()/INSERT IGNORE are translated for SQLite.
 */

const path = require('path');
const fs   = require('fs');
const config = require('../config');

let query;

if (config.db.driver === 'mysql') {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: config.db.host, port: config.db.port,
    user: config.db.user, password: config.db.password,
    database: config.db.database,
    waitForConnections: true, connectionLimit: 10, dateStrings: true
  });
  query = async (sql, params = []) => {
    const [rows] = await pool.query(sql, params);
    return rows;
  };
} else {
  const Database = require('better-sqlite3');
  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const sqlite = new Database(path.join(dataDir, 'indiaoffers.db'));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  // Forward migrations (idempotent) — add columns missing from older DB files.
  const addColumn = (table, col, ddl) => {
    const has = sqlite.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);
    if (!has) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  addColumn('stores', 'affiliate_params', 'affiliate_params TEXT');
  addColumn('stores', 'affiliate_prefix', 'affiliate_prefix TEXT');
  addColumn('deals', 'true_price', 'true_price REAL');
  addColumn('deals', 'savings_note', 'savings_note TEXT');
  addColumn('deals', 'savings_rows', 'savings_rows TEXT');
  addColumn('deals', 'seo_categories', 'seo_categories TEXT');
  addColumn('alerts', 'sent_at', 'sent_at TEXT');
  addColumn('users', 'points', 'points INTEGER DEFAULT 0');
  addColumn('deals', 'hotness', 'hotness INTEGER DEFAULT 0');
  addColumn('deals', 'video_url', 'video_url TEXT');
  addColumn('deals', 'verified_at', 'verified_at TEXT');
  addColumn('guides', 'is_trending', 'is_trending INTEGER DEFAULT 0');
  // DEFAULT 1 grandfathers users who registered before email verification existed;
  // new signups explicitly insert 0 and must verify.
  addColumn('users', 'email_verified', 'email_verified INTEGER DEFAULT 1');
  addColumn('users', 'otp_code', 'otp_code TEXT');
  addColumn('users', 'verify_token', 'verify_token TEXT');
  addColumn('users', 'otp_expires', 'otp_expires TEXT');

  const toSqlite = sql => sql
    .replace(/INSERT\s+IGNORE/gi, 'INSERT OR IGNORE')
    .replace(/\bNOW\(\)/gi, "datetime('now')");

  query = async (sql, params = []) => {
    const stmt = sqlite.prepare(toSqlite(sql));
    const bound = params.map(p => (p === undefined ? null : p));
    if (stmt.reader) return stmt.all(...bound);
    const info = stmt.run(...bound);
    return { affectedRows: info.changes, insertId: Number(info.lastInsertRowid) };
  };
}

const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const today  = () => new Date().toISOString().slice(0, 10);
const uid    = p => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const slugify = s => String(s).toLowerCase()
  .replace(/[₹%]/g, '').replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

module.exports = { query, driver: config.db.driver, nowSql, today, uid, slugify };
