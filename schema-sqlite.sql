-- ═══════════════════════════════════════════════════════════════════════════
--  IndiaOffers.in — SQLite schema (mirror of schema.sql, applied automatically
--  by db.js on first run when DB_DRIVER=sqlite)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  phone           TEXT,
  password_hash   TEXT NOT NULL,
  referral_code   TEXT UNIQUE,
  wallet          REAL DEFAULT 0,
  total_earned    REAL DEFAULT 0,
  is_admin        INTEGER DEFAULT 0,
  is_active       INTEGER DEFAULT 1,
  joined          TEXT,
  last_login      TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stores (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE,
  description     TEXT,
  logo_url        TEXT,
  color           TEXT,
  initial         TEXT,
  category        TEXT,
  cashback_rate   REAL DEFAULT 0.05,
  cashback_label  TEXT,
  affiliate_url   TEXT,
  affiliate_type  TEXT DEFAULT 'pixel',
  network_id      TEXT,
  is_active       INTEGER DEFAULT 1,
  is_featured     INTEGER DEFAULT 0,
  deals_count     INTEGER DEFAULT 0,
  total_users     INTEGER DEFAULT 0,
  rating          REAL DEFAULT 4.0,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deals (
  id              TEXT PRIMARY KEY,
  store_id        TEXT NOT NULL REFERENCES stores(id),
  title           TEXT NOT NULL,
  description     TEXT,
  coupon_code     TEXT,
  deal_type       TEXT DEFAULT 'deal',
  category        TEXT,
  cashback_rate   REAL,
  cashback_label  TEXT,
  discount_pct    INTEGER DEFAULT 0,
  min_order       REAL DEFAULT 0,
  max_cashback    REAL,
  original_price  REAL,
  deal_price      REAL,
  deal_url        TEXT,
  how_to_get      TEXT,
  image_url       TEXT,
  badge           TEXT,
  is_trending     INTEGER DEFAULT 0,
  is_exclusive    INTEGER DEFAULT 0,
  is_expiring     INTEGER DEFAULT 0,
  is_active       INTEGER DEFAULT 1,
  uses_count      INTEGER DEFAULT 0,
  expiry_date     TEXT,
  start_date      TEXT,
  meta_title      TEXT,
  meta_desc       TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  deal_id         TEXT,
  store           TEXT NOT NULL,
  raw_url         TEXT,
  tagged_url      TEXT,
  ip_address      TEXT,
  user_agent      TEXT,
  referrer        TEXT,
  clicked_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  store_id          TEXT NOT NULL REFERENCES stores(id),
  deal_id           TEXT,
  click_id          TEXT,
  order_number      TEXT NOT NULL,
  order_amount      REAL NOT NULL,
  cashback_amount   REAL NOT NULL DEFAULT 0,
  cashback_rate     REAL,
  coupon_used       TEXT,
  order_date        TEXT,
  source            TEXT DEFAULT 'manual',
  status            TEXT DEFAULT 'pending',
  receipt_url       TEXT,
  admin_notes       TEXT,
  verified_at       TEXT,
  confirmed_at      TEXT,
  paid_at           TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now')),
  UNIQUE (user_id, store_id, order_number)
);

CREATE TABLE IF NOT EXISTS amazon_sales (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  amazon_order_id TEXT UNIQUE NOT NULL,
  asin            TEXT,
  title           TEXT,
  revenue         REAL,
  commission      REAL,
  cashback_amount REAL,
  user_id         TEXT,
  click_id        TEXT,
  order_date      TEXT,
  status          TEXT DEFAULT 'pending',
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS flipkart_sales (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  fk_order_id     TEXT UNIQUE NOT NULL,
  order_amount    REAL,
  commission      REAL,
  cashback_amount REAL,
  user_id         TEXT,
  click_id        TEXT,
  product_name    TEXT,
  category        TEXT,
  status          TEXT DEFAULT 'tracking',
  raw_payload     TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pixel_sales (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id     TEXT NOT NULL,
  click_id        TEXT,
  order_id        TEXT NOT NULL,
  order_amount    REAL,
  currency        TEXT DEFAULT 'INR',
  cashback_amount REAL,
  user_id         TEXT,
  sale_url        TEXT,
  sale_ts         TEXT,
  status          TEXT DEFAULT 'tracking',
  created_at      TEXT DEFAULT (datetime('now')),
  UNIQUE (merchant_id, order_id)
);

CREATE TABLE IF NOT EXISTS merchants (
  id              TEXT PRIMARY KEY,
  store_id        TEXT,
  name            TEXT NOT NULL,
  domain          TEXT UNIQUE,
  cashback_rate   REAL DEFAULT 0.05,
  secret_key      TEXT NOT NULL,
  is_active       INTEGER DEFAULT 1,
  contact_email   TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  amount          REAL NOT NULL,
  method          TEXT NOT NULL,
  details         TEXT,
  status          TEXT DEFAULT 'pending',
  admin_notes     TEXT,
  processed_at    TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS claims (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  store_id          TEXT,
  order_number      TEXT NOT NULL,
  order_amount      REAL,
  expected_cashback REAL,
  order_date        TEXT,
  notes             TEXT,
  receipt_url       TEXT,
  status            TEXT DEFAULT 'pending',
  resolution_notes  TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS referrals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id     TEXT NOT NULL REFERENCES users(id),
  referred_id     TEXT NOT NULL REFERENCES users(id),
  bonus           REAL DEFAULT 100,
  date            TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL REFERENCES users(id),
  title           TEXT,
  message         TEXT,
  type            TEXT,
  is_read         INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id         TEXT NOT NULL REFERENCES users(id),
  deal_id         TEXT NOT NULL REFERENCES deals(id),
  created_at      TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, deal_id)
);

CREATE TABLE IF NOT EXISTS banners (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  image_url       TEXT,
  bg_color        TEXT DEFAULT '#2563eb',
  deal_id         TEXT,
  store_id        TEXT,
  sort_order      INTEGER DEFAULT 0,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  slug            TEXT UNIQUE,
  excerpt         TEXT,
  content         TEXT,
  category        TEXT,
  image_url       TEXT,
  meta_title      TEXT,
  meta_desc       TEXT,
  read_time_mins  INTEGER DEFAULT 5,
  is_published    INTEGER DEFAULT 0,
  author_id       TEXT,
  published_at    TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clicks_user     ON affiliate_clicks (user_id);
CREATE INDEX IF NOT EXISTS idx_clicks_store    ON affiliate_clicks (store, clicked_at);
CREATE INDEX IF NOT EXISTS idx_orders_user     ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders (status);
CREATE INDEX IF NOT EXISTS idx_deals_store     ON deals (store_id);
CREATE INDEX IF NOT EXISTS idx_deals_active    ON deals (is_active);
CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_wd_user         ON withdrawals (user_id);
CREATE INDEX IF NOT EXISTS idx_claims_user     ON claims (user_id);

CREATE VIEW IF NOT EXISTS sitemap_urls AS
  SELECT '/store/' || slug AS url, created_at AS updated_at FROM stores WHERE is_active = 1
  UNION ALL
  SELECT '/deal/' || id, updated_at FROM deals WHERE is_active = 1
  UNION ALL
  SELECT '/blog/' || slug, updated_at FROM blog_posts WHERE is_published = 1;
