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
  affiliate_params TEXT,                    -- admin-managed query params appended on redirect, e.g. "tag=indiaoffers-21&subid={click}"
  affiliate_prefix TEXT,                    -- network tracking link the outbound URL is appended to, e.g. "https://track.vcommission.com/click?campaign_id=..&p1={click}&url="
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
  seo_categories  TEXT,                     -- extra related leaf slugs, comma-wrapped: ,a,b,
  image_url       TEXT,
  mrp             REAL,                     -- original price
  price           REAL,                     -- deal price
  true_price      REAL,                     -- admin override of computed "true price" (blank = auto-stack)
  savings_note    TEXT,                     -- admin note shown in the savings stack (blank = auto)
  savings_rows    TEXT,                     -- JSON array of manual pay-option rows; when set, replaces auto-matched bank offers
  coupon_code     TEXT,
  deal_url        TEXT,                     -- merchant product/offer page
  how_to          TEXT,                     -- JSON array of steps
  badge           TEXT,                     -- HOT / LOOT / NEW ...
  cashback_text   TEXT,
  is_trending     INTEGER DEFAULT 0,        -- ticked = shown in home hero banners
  hotness         INTEGER DEFAULT 0,        -- >0 pins the deal to the top of the homepage grid
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
  bank_card_id    TEXT,                     -- optional link to a specific bank_cards row (drives user alerts)
  promo_code      TEXT,
  valid_from      TEXT,
  valid_till      TEXT,
  source_url      TEXT,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Bank credit/debit cards users can APPLY for (affiliate card sign-ups) ─────────
CREATE TABLE IF NOT EXISTS bank_cards (
  id              TEXT PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,            -- "HDFC Millennia Credit Card"
  bank            TEXT NOT NULL,            -- HDFC Bank
  network         TEXT,                     -- Visa | Mastercard | RuPay | Amex
  card_type       TEXT DEFAULT 'credit',    -- credit | debit
  image_url       TEXT,
  tagline         TEXT,
  joining_fee     TEXT,                     -- free-text, e.g. "₹1,000 + GST"
  annual_fee      TEXT,
  best_for        TEXT,                     -- "Online shopping & dining"
  benefits        TEXT,                     -- JSON array of benefit strings
  how_to_apply    TEXT,                     -- JSON array of steps
  eligibility     TEXT,
  apply_url       TEXT,                     -- affiliate apply link
  video_url       TEXT,                     -- YouTube embed/watch URL
  is_featured     INTEGER DEFAULT 0,
  sort_order      INTEGER DEFAULT 0,
  is_active       INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Buying guides: "Best AC", "Best 55-inch TV" … ranked pick lists ──────────────
CREATE TABLE IF NOT EXISTS guides (
  id              TEXT PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,            -- "Best Air Conditioners in India (2026)"
  category        TEXT,                     -- taxonomy slug
  subtitle        TEXT,
  intro           TEXT,
  hero_image      TEXT,
  video_url       TEXT,                     -- overall buying-guide video
  is_trending     INTEGER DEFAULT 0,        -- ticked = shown in home hero banners
  is_active       INTEGER DEFAULT 1,
  sort_order      INTEGER DEFAULT 0,
  updated_at      TEXT DEFAULT (datetime('now')),
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guide_items (
  id              TEXT PRIMARY KEY,
  guide_id        TEXT NOT NULL REFERENCES guides(id),
  rank_no         INTEGER DEFAULT 0,
  name            TEXT NOT NULL,            -- product name
  image_url       TEXT,
  price           REAL,
  award           TEXT,                     -- "Best Overall", "Best Budget"
  features        TEXT,                     -- JSON array
  pros            TEXT,                     -- JSON array
  cons            TEXT,                     -- JSON array
  why_choose      TEXT,                     -- prose: why our user should pick this
  video_url       TEXT,                     -- per-product review video
  buy_url         TEXT,                     -- merchant/affiliate link
  deal_id         TEXT,                     -- optional link to a deals row
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Registered users (deal & card-sale alert subscribers) ───────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  username        TEXT UNIQUE NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  mobile          TEXT,
  password_hash   TEXT NOT NULL,
  whatsapp_optin  INTEGER DEFAULT 0,        -- consent to WhatsApp updates
  is_bulk_buyer   INTEGER DEFAULT 0,        -- buys for a business/shop
  points          INTEGER DEFAULT 0,        -- partner rewards earned from approved deal submissions
  email_verified  INTEGER DEFAULT 0,        -- 1 after the OTP / link check
  otp_code        TEXT,                     -- current 6-digit verification code
  verify_token    TEXT,                     -- one-click verification link token
  otp_expires     TEXT,                     -- epoch ms the code/token dies (string for cross-db)
  is_active       INTEGER DEFAULT 1,
  last_login      TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Categories a user wants alerts for (many-to-many, taxonomy slug) ─────────────
CREATE TABLE IF NOT EXISTS user_categories (
  user_id         TEXT NOT NULL REFERENCES users(id),
  category        TEXT NOT NULL,
  PRIMARY KEY (user_id, category)
);

-- Bank cards a user holds → drives "sale on your card" alerts ──────────────────
CREATE TABLE IF NOT EXISTS user_cards (
  user_id         TEXT NOT NULL REFERENCES users(id),
  bank_card_id    TEXT NOT NULL REFERENCES bank_cards(id),
  PRIMARY KEY (user_id, bank_card_id)
);

-- Alert queue: rows generated when a bank offer targets a card a user holds ────
CREATE TABLE IF NOT EXISTS alerts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL,
  kind            TEXT DEFAULT 'card_offer',  -- card_offer | category_deal
  title           TEXT NOT NULL,
  body            TEXT,
  link_url        TEXT,
  bank_offer_id   TEXT,
  is_sent         INTEGER DEFAULT 0,
  is_read         INTEGER DEFAULT 0,
  sent_at         TEXT,
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

-- Deals submitted by registered users (partner programme). Admin reviews each
-- one, approves (awarding points) or rejects; approved deals are then published
-- by the admin as normal deals.
CREATE TABLE IF NOT EXISTS user_deals (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  deal_url        TEXT NOT NULL,
  price           REAL,
  mrp             REAL,
  store_name      TEXT,
  coupon_code     TEXT,
  image_url       TEXT,
  note            TEXT,                     -- why it's a great deal
  status          TEXT DEFAULT 'pending',   -- pending | approved | rejected
  points          INTEGER DEFAULT 0,        -- points awarded on approval
  admin_note      TEXT,
  reviewed_at     TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Queries submitted through the Contact Us form (also emailed to support)
CREATE TABLE IF NOT EXISTS contact_messages (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  mobile          TEXT,
  topic           TEXT,
  message         TEXT NOT NULL,
  created_at      TEXT DEFAULT (datetime('now'))
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
CREATE INDEX IF NOT EXISTS idx_cards_active    ON bank_cards (is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_guides_active   ON guides (is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_gitems_guide    ON guide_items (guide_id, rank_no);
CREATE INDEX IF NOT EXISTS idx_alerts_user     ON alerts (user_id, is_read);
