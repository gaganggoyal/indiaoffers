-- ═══════════════════════════════════════════════════════════════════════════
--  IndiaOffers.in v2 — SQLite schema (auto-applied by src/db/index.js)
--  Mirror for MySQL lives in schema.mysql.sql
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stores (
  id              TEXT PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  color           TEXT DEFAULT '#4f46e5',
  logo_url        TEXT,
  category        TEXT,
  description     TEXT,
  website_url     TEXT,
  affiliate_url   TEXT,
  affiliate_type  TEXT DEFAULT 'none',      -- none | amazon | flipkart
  cashback_text   TEXT,                     -- informational, e.g. "Upto 5% IO rewards"
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deals (
  id              TEXT PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  store_id        TEXT NOT NULL REFERENCES stores(id),
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  image_url       TEXT,
  mrp             REAL,                     -- original price
  price           REAL,                     -- deal price
  coupon_code     TEXT,
  deal_url        TEXT,                     -- merchant product/offer page
  how_to          TEXT,                     -- JSON array of steps
  badge           TEXT,                     -- HOT / LOOT / NEW ...
  cashback_text   TEXT,
  is_trending     INTEGER DEFAULT 0,
  is_active       INTEGER DEFAULT 1,
  clicks          INTEGER DEFAULT 0,
  expiry_date     TEXT,
  posted_at       TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Bank / card / UPI offers — the differentiator
CREATE TABLE IF NOT EXISTS bank_offers (
  id              TEXT PRIMARY KEY,
  bank            TEXT NOT NULL,            -- HDFC Bank, ICICI Bank, SBI, Axis, ...
  instrument      TEXT DEFAULT 'credit',    -- credit | debit | upi | netbanking | emi | any
  title           TEXT NOT NULL,
  description     TEXT,
  discount_type   TEXT DEFAULT 'percent',   -- percent | flat
  discount_value  REAL NOT NULL,
  max_discount    REAL,                     -- cap in ₹ (NULL = uncapped)
  min_order       REAL DEFAULT 0,
  store_id        TEXT,                     -- NULL = valid on all stores
  promo_code      TEXT,
  valid_from      TEXT,
  valid_till      TEXT,
  source_url      TEXT,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coupons (
  id              TEXT PRIMARY KEY,
  store_id        TEXT NOT NULL REFERENCES stores(id),
  code            TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  discount_text   TEXT,                     -- "Flat 50% OFF", "₹200 OFF above ₹999"
  min_order       REAL DEFAULT 0,
  expiry_date     TEXT,
  is_verified     INTEGER DEFAULT 0,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS banners (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  image_url       TEXT,
  bg_color        TEXT DEFAULT '#4f46e5',
  link_url        TEXT,                     -- internal path (/deal/xyz) or external
  sort_order      INTEGER DEFAULT 0,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clicks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id         TEXT,
  store_id        TEXT,
  target_url      TEXT,
  ip              TEXT,
  user_agent      TEXT,
  referrer        TEXT,
  clicked_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admins (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  last_login      TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_deals_store    ON deals (store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_deals_category ON deals (category, is_active);
CREATE INDEX IF NOT EXISTS idx_deals_trending ON deals (is_trending, is_active);
CREATE INDEX IF NOT EXISTS idx_offers_store   ON bank_offers (store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_offers_bank    ON bank_offers (bank, is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_store  ON coupons (store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_clicks_deal    ON clicks (deal_id, clicked_at);
