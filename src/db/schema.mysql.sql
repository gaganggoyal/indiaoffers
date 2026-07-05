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
  image_url       VARCHAR(1000),
  mrp             DECIMAL(10,2),
  price           DECIMAL(10,2),
  coupon_code     VARCHAR(50),
  deal_url        VARCHAR(1000),
  how_to          TEXT,
  badge           VARCHAR(30),
  cashback_text   VARCHAR(100),
  is_trending     TINYINT(1) DEFAULT 0,
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
