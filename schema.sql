-- ═══════════════════════════════════════════════════════════════════════════
--  IndiaOffers.in — MySQL Database Schema
--  Run once to set up all tables
-- ═══════════════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS indiaoffers CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE indiaoffers;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR(32) PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  phone           VARCHAR(15),
  password_hash   VARCHAR(255) NOT NULL,
  referral_code   VARCHAR(20) UNIQUE,
  wallet          DECIMAL(10,2) DEFAULT 0.00,
  total_earned    DECIMAL(10,2) DEFAULT 0.00,
  is_admin        TINYINT(1) DEFAULT 0,
  is_active       TINYINT(1) DEFAULT 1,
  joined          DATE,
  last_login      DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_referral_code (referral_code)
) ENGINE=InnoDB;

-- ── Stores ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stores (
  id              VARCHAR(20) PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  slug            VARCHAR(100) UNIQUE,
  description     TEXT,
  logo_url        VARCHAR(500),
  color           VARCHAR(20),
  initial         VARCHAR(5),
  category        VARCHAR(50),
  cashback_rate   DECIMAL(5,4) DEFAULT 0.05,   -- e.g. 0.08 = 8%
  cashback_label  VARCHAR(20),                  -- e.g. "Up to 8%"
  affiliate_url   VARCHAR(500),
  affiliate_type  ENUM('direct','amazon','flipkart','network','pixel') DEFAULT 'pixel',
  network_id      VARCHAR(100),
  is_active       TINYINT(1) DEFAULT 1,
  is_featured     TINYINT(1) DEFAULT 0,
  deals_count     INT DEFAULT 0,
  total_users     INT DEFAULT 0,
  rating          DECIMAL(3,1) DEFAULT 4.0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_slug (slug)
) ENGINE=InnoDB;

-- ── Deals / Coupons ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id              VARCHAR(20) PRIMARY KEY,
  store_id        VARCHAR(20) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  coupon_code     VARCHAR(50),
  deal_type       ENUM('coupon','deal','cashback','offer') DEFAULT 'deal',
  category        VARCHAR(50),
  cashback_rate   DECIMAL(5,4),
  cashback_label  VARCHAR(20),
  discount_pct    INT DEFAULT 0,
  min_order       DECIMAL(10,2) DEFAULT 0,
  max_cashback    DECIMAL(10,2),
  original_price  DECIMAL(10,2),
  deal_price      DECIMAL(10,2),
  deal_url        VARCHAR(1000),
  how_to_get      TEXT,
  image_url       VARCHAR(500),
  badge           VARCHAR(30),
  is_trending     TINYINT(1) DEFAULT 0,
  is_exclusive    TINYINT(1) DEFAULT 0,
  is_expiring     TINYINT(1) DEFAULT 0,
  is_active       TINYINT(1) DEFAULT 1,
  uses_count      INT DEFAULT 0,
  expiry_date     DATE,
  start_date      DATE,
  meta_title      VARCHAR(200),
  meta_desc       VARCHAR(300),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  INDEX idx_store (store_id),
  INDEX idx_category (category),
  INDEX idx_active (is_active),
  INDEX idx_trending (is_trending)
) ENGINE=InnoDB;

-- ── Affiliate Clicks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id              VARCHAR(64) PRIMARY KEY,
  user_id         VARCHAR(32),
  deal_id         VARCHAR(20),
  store           VARCHAR(50) NOT NULL,
  raw_url         TEXT,
  tagged_url      TEXT,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  referrer        VARCHAR(500),
  clicked_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_store (store),
  INDEX idx_clicked_at (clicked_at)
) ENGINE=InnoDB;

-- ── Orders (manually submitted + pixel-detected) ─────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                VARCHAR(32) PRIMARY KEY,
  user_id           VARCHAR(32) NOT NULL,
  store_id          VARCHAR(20) NOT NULL,
  deal_id           VARCHAR(20),
  click_id          VARCHAR(64),
  order_number      VARCHAR(100) NOT NULL,
  order_amount      DECIMAL(10,2) NOT NULL,
  cashback_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
  cashback_rate     DECIMAL(5,4),
  coupon_used       VARCHAR(50),
  order_date        DATE,
  source            ENUM('manual','pixel','postback','api') DEFAULT 'manual',
  status            ENUM('pending','tracking','verified','confirmed','paid','cancelled','disputed') DEFAULT 'pending',
  receipt_url       VARCHAR(500),
  admin_notes       TEXT,
  verified_at       DATETIME,
  confirmed_at      DATETIME,
  paid_at           DATETIME,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  UNIQUE KEY uniq_order (user_id, store_id, order_number),
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_store (store_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ── Amazon Sales (from daily report reconciliation) ───────────────────────────
CREATE TABLE IF NOT EXISTS amazon_sales (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  amazon_order_id VARCHAR(100) UNIQUE NOT NULL,
  asin            VARCHAR(20),
  title           VARCHAR(300),
  revenue         DECIMAL(10,2),
  commission      DECIMAL(10,2),
  cashback_amount DECIMAL(10,2),
  user_id         VARCHAR(32),
  click_id        VARCHAR(64),
  order_date      DATE,
  status          ENUM('confirmed','cancelled','pending') DEFAULT 'pending',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (amazon_order_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- ── Flipkart Sales (from real-time postback) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS flipkart_sales (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  fk_order_id     VARCHAR(100) UNIQUE NOT NULL,
  order_amount    DECIMAL(10,2),
  commission      DECIMAL(10,2),
  cashback_amount DECIMAL(10,2),
  user_id         VARCHAR(32),
  click_id        VARCHAR(64),
  product_name    VARCHAR(300),
  category        VARCHAR(100),
  status          ENUM('confirmed','cancelled','pending','tracking') DEFAULT 'tracking',
  raw_payload     TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fk_order (fk_order_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- ── Pixel Sales (from universal pixel.js) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS pixel_sales (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  merchant_id     VARCHAR(32) NOT NULL,
  click_id        VARCHAR(64),
  order_id        VARCHAR(100) NOT NULL,
  order_amount    DECIMAL(10,2),
  currency        VARCHAR(10) DEFAULT 'INR',
  cashback_amount DECIMAL(10,2),
  user_id         VARCHAR(32),
  sale_url        TEXT,
  sale_ts         DATETIME,
  status          ENUM('tracking','confirmed','paid','cancelled') DEFAULT 'tracking',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sale (merchant_id, order_id),
  INDEX idx_user (user_id),
  INDEX idx_merchant (merchant_id)
) ENGINE=InnoDB;

-- ── Merchants (stores that use our pixel) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS merchants (
  id              VARCHAR(32) PRIMARY KEY,
  store_id        VARCHAR(20),
  name            VARCHAR(100) NOT NULL,
  domain          VARCHAR(200) UNIQUE,
  cashback_rate   DECIMAL(5,4) DEFAULT 0.05,
  secret_key      VARCHAR(64) NOT NULL,
  is_active       TINYINT(1) DEFAULT 1,
  contact_email   VARCHAR(150),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Withdrawals ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawals (
  id              VARCHAR(32) PRIMARY KEY,
  user_id         VARCHAR(32) NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  method          ENUM('UPI','Bank Transfer','Paytm','PhonePe','Amazon Pay') NOT NULL,
  details         VARCHAR(200),
  status          ENUM('pending','processing','approved','rejected') DEFAULT 'pending',
  admin_notes     TEXT,
  processed_at    DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- ── Missing Cashback Claims ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claims (
  id              VARCHAR(32) PRIMARY KEY,
  user_id         VARCHAR(32) NOT NULL,
  store_id        VARCHAR(20),
  order_number    VARCHAR(100) NOT NULL,
  order_amount    DECIMAL(10,2),
  expected_cashback DECIMAL(10,2),
  order_date      DATE,
  notes           TEXT,
  receipt_url     VARCHAR(500),
  status          ENUM('pending','investigating','approved','rejected') DEFAULT 'pending',
  resolution_notes TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- ── Referrals ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  referrer_id     VARCHAR(32) NOT NULL,
  referred_id     VARCHAR(32) NOT NULL,
  bonus           DECIMAL(10,2) DEFAULT 100,
  date            DATE,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referred_id) REFERENCES users(id),
  INDEX idx_referrer (referrer_id)
) ENGINE=InnoDB;

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         VARCHAR(32) NOT NULL,
  title           VARCHAR(200),
  message         TEXT,
  type            VARCHAR(30),
  is_read         TINYINT(1) DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_read (user_id, is_read)
) ENGINE=InnoDB;

-- ── Favorites ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  user_id         VARCHAR(32) NOT NULL,
  deal_id         VARCHAR(20) NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, deal_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (deal_id) REFERENCES deals(id)
) ENGINE=InnoDB;

-- ── Banners (admin-managed hero banners) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS banners (
  id              VARCHAR(32) PRIMARY KEY,
  title           VARCHAR(200) NOT NULL,
  subtitle        VARCHAR(300),
  image_url       VARCHAR(1000),
  bg_color        VARCHAR(20) DEFAULT '#2563eb',
  deal_id         VARCHAR(20),
  store_id        VARCHAR(20),
  sort_order      INT DEFAULT 0,
  is_active       TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Blog Posts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id              VARCHAR(20) PRIMARY KEY,
  title           VARCHAR(200) NOT NULL,
  slug            VARCHAR(200) UNIQUE,
  excerpt         TEXT,
  content         LONGTEXT,
  category        VARCHAR(50),
  image_url       VARCHAR(500),
  meta_title      VARCHAR(200),
  meta_desc       VARCHAR(300),
  read_time_mins  INT DEFAULT 5,
  is_published    TINYINT(1) DEFAULT 0,
  author_id       VARCHAR(32),
  published_at    DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FULLTEXT INDEX ft_title_content (title, content),
  INDEX idx_slug (slug),
  INDEX idx_published (is_published, published_at)
) ENGINE=InnoDB;

-- ── Sitemap helper view ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW sitemap_urls AS
  SELECT CONCAT('/store/', slug) AS url, created_at AS updated_at FROM stores WHERE is_active=1
  UNION ALL
  SELECT CONCAT('/deal/', id), updated_at FROM deals WHERE is_active=1
  UNION ALL
  SELECT CONCAT('/blog/', slug), updated_at FROM blog_posts WHERE is_published=1;

-- ── Seed admin user ───────────────────────────────────────────────────────────
INSERT IGNORE INTO users (id, name, email, password_hash, referral_code, wallet, is_admin, joined)
VALUES ('admin_1', 'Admin', 'admin@indiaoffers.in',
        '$2b$10$REPLACEWITHBCRYPTHASH', 'ADMIN2024', 0, 1, CURDATE());
-- Generate hash: node -e "const b=require('bcryptjs'); console.log(b.hashSync('YourAdminPassword',10))"
