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
