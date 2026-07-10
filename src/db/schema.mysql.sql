-- ═══════════════════════════════════════════════════════════════════════════
--  IndiaOffers.in v2 — MySQL schema (run once: mysql -u root -p < schema.mysql.sql)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS indiaoffers CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE indiaoffers;

CREATE TABLE IF NOT EXISTS stores (
  id              VARCHAR(32) PRIMARY KEY,
  slug            VARCHAR(100) UNIQUE NOT NULL,
  name            VARCHAR(100) NOT NULL,
  color           VARCHAR(20) DEFAULT '#4f46e5',
  logo_url        VARCHAR(500),
  category        VARCHAR(50),
  description     TEXT,
  website_url     VARCHAR(500),
  affiliate_url   VARCHAR(500),
  affiliate_type  ENUM('none','amazon','flipkart') DEFAULT 'none',
  affiliate_params VARCHAR(500),            -- admin-managed query params appended on redirect, e.g. "tag=indiaoffers-21&subid={click}"
  affiliate_prefix VARCHAR(1000),           -- network tracking link the outbound URL is appended to, e.g. "https://track.vcommission.com/click?campaign_id=..&p1={click}&url="
  cashback_text   VARCHAR(100),
  is_active       TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_slug (slug)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS deals (
  id              VARCHAR(32) PRIMARY KEY,
  slug            VARCHAR(120) UNIQUE NOT NULL,
  store_id        VARCHAR(32) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(50),
  seo_categories  VARCHAR(255),             -- extra related leaf slugs, comma-wrapped: ,a,b,
  image_url       VARCHAR(1000),
  mrp             DECIMAL(10,2),
  price           DECIMAL(10,2),
  true_price      DECIMAL(10,2),
  savings_note    VARCHAR(300),
  savings_rows    TEXT,
  coupon_code     VARCHAR(50),
  deal_url        VARCHAR(1000),
  how_to          TEXT,
  badge           VARCHAR(30),
  cashback_text   VARCHAR(100),
  is_trending     TINYINT(1) DEFAULT 0,
  hotness         INT DEFAULT 0,
  is_active       TINYINT(1) DEFAULT 1,
  clicks          INT DEFAULT 0,
  expiry_date     DATE,
  posted_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  INDEX idx_store (store_id, is_active),
  INDEX idx_category (category, is_active),
  INDEX idx_trending (is_trending, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_offers (
  id              VARCHAR(32) PRIMARY KEY,
  bank            VARCHAR(60) NOT NULL,
  instrument      ENUM('credit','debit','upi','netbanking','emi','any') DEFAULT 'credit',
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  discount_type   ENUM('percent','flat') DEFAULT 'percent',
  discount_value  DECIMAL(10,2) NOT NULL,
  max_discount    DECIMAL(10,2),
  min_order       DECIMAL(10,2) DEFAULT 0,
  store_id        VARCHAR(32),
  bank_card_id    VARCHAR(32),
  promo_code      VARCHAR(50),
  valid_from      DATE,
  valid_till      DATE,
  source_url      VARCHAR(1000),
  is_active       TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_store (store_id, is_active),
  INDEX idx_bank (bank, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS coupons (
  id              VARCHAR(32) PRIMARY KEY,
  store_id        VARCHAR(32) NOT NULL,
  code            VARCHAR(50) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  discount_text   VARCHAR(100),
  min_order       DECIMAL(10,2) DEFAULT 0,
  expiry_date     DATE,
  is_verified     TINYINT(1) DEFAULT 0,
  is_active       TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  INDEX idx_store (store_id, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS banners (
  id              VARCHAR(32) PRIMARY KEY,
  title           VARCHAR(200) NOT NULL,
  subtitle        VARCHAR(300),
  image_url       VARCHAR(1000),
  bg_color        VARCHAR(20) DEFAULT '#4f46e5',
  link_url        VARCHAR(1000),
  sort_order      INT DEFAULT 0,
  is_active       TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clicks (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  deal_id         VARCHAR(32),
  store_id        VARCHAR(32),
  target_url      TEXT,
  ip              VARCHAR(45),
  user_agent      TEXT,
  referrer        VARCHAR(500),
  clicked_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_deal (deal_id, clicked_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admins (
  id              VARCHAR(32) PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(150) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  last_login      DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_cards (
  id              VARCHAR(32) PRIMARY KEY,
  slug            VARCHAR(120) UNIQUE NOT NULL,
  name            VARCHAR(150) NOT NULL,
  bank            VARCHAR(60) NOT NULL,
  network         VARCHAR(30),
  card_type       ENUM('credit','debit') DEFAULT 'credit',
  image_url       VARCHAR(1000),
  tagline         VARCHAR(300),
  joining_fee     VARCHAR(60),
  annual_fee      VARCHAR(60),
  best_for        VARCHAR(200),
  benefits        TEXT,
  how_to_apply    TEXT,
  eligibility     TEXT,
  apply_url       VARCHAR(1000),
  video_url       VARCHAR(1000),
  is_featured     TINYINT(1) DEFAULT 0,
  sort_order      INT DEFAULT 0,
  is_active       TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_active (is_active, sort_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS guides (
  id              VARCHAR(32) PRIMARY KEY,
  slug            VARCHAR(120) UNIQUE NOT NULL,
  title           VARCHAR(200) NOT NULL,
  category        VARCHAR(50),
  subtitle        VARCHAR(300),
  intro           TEXT,
  hero_image      VARCHAR(1000),
  video_url       VARCHAR(1000),
  is_trending     TINYINT(1) DEFAULT 0,
  is_active       TINYINT(1) DEFAULT 1,
  sort_order      INT DEFAULT 0,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_active (is_active, sort_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS guide_items (
  id              VARCHAR(32) PRIMARY KEY,
  guide_id        VARCHAR(32) NOT NULL,
  rank_no         INT DEFAULT 0,
  name            VARCHAR(200) NOT NULL,
  image_url       VARCHAR(1000),
  price           DECIMAL(10,2),
  award           VARCHAR(60),
  features        TEXT,
  pros            TEXT,
  cons            TEXT,
  why_choose      TEXT,
  video_url       VARCHAR(1000),
  buy_url         VARCHAR(1000),
  deal_id         VARCHAR(32),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guide_id) REFERENCES guides(id),
  INDEX idx_guide (guide_id, rank_no)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR(32) PRIMARY KEY,
  username        VARCHAR(60) UNIQUE NOT NULL,
  email           VARCHAR(150) UNIQUE NOT NULL,
  mobile          VARCHAR(20),
  password_hash   VARCHAR(255) NOT NULL,
  whatsapp_optin  TINYINT(1) DEFAULT 0,
  is_bulk_buyer   TINYINT(1) DEFAULT 0,
  points          INT DEFAULT 0,
  is_active       TINYINT(1) DEFAULT 1,
  last_login      DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_categories (
  user_id         VARCHAR(32) NOT NULL,
  category        VARCHAR(50) NOT NULL,
  PRIMARY KEY (user_id, category),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_cards (
  user_id         VARCHAR(32) NOT NULL,
  bank_card_id    VARCHAR(32) NOT NULL,
  PRIMARY KEY (user_id, bank_card_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS alerts (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         VARCHAR(32) NOT NULL,
  kind            VARCHAR(30) DEFAULT 'card_offer',
  title           VARCHAR(200) NOT NULL,
  body            TEXT,
  link_url        VARCHAR(1000),
  bank_offer_id   VARCHAR(32),
  is_sent         TINYINT(1) DEFAULT 0,
  is_read         TINYINT(1) DEFAULT 0,
  sent_at         DATETIME NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id, is_read)
) ENGINE=InnoDB;

-- Deals submitted by registered users (partner programme)
CREATE TABLE IF NOT EXISTS user_deals (
  id              VARCHAR(32) PRIMARY KEY,
  user_id         VARCHAR(32) NOT NULL,
  title           VARCHAR(300) NOT NULL,
  deal_url        VARCHAR(1000) NOT NULL,
  price           DECIMAL(12,2),
  mrp             DECIMAL(12,2),
  store_name      VARCHAR(120),
  coupon_code     VARCHAR(80),
  image_url       VARCHAR(1000),
  note            TEXT,
  status          VARCHAR(20) DEFAULT 'pending',
  points          INT DEFAULT 0,
  admin_note      VARCHAR(500),
  reviewed_at     DATETIME NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ud_status (status, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- Queries submitted through the Contact Us form (also emailed to support)
CREATE TABLE IF NOT EXISTS contact_messages (
  id              VARCHAR(32) PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(150) NOT NULL,
  mobile          VARCHAR(20),
  topic           VARCHAR(80),
  message         TEXT NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
