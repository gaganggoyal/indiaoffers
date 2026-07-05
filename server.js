/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  IndiaOffers.in — Backend API Server (Node.js + Express)
 *
 *  Tracking:
 *    GET  /go/:store                 Affiliate click redirect (logs click, sets io_click cookie)
 *    POST /track/sale                Universal pixel endpoint (tracking/pixel.js)
 *    GET  /track/sale.gif            Image-pixel fallback (same processing)
 *    GET  /postback/flipkart         Flipkart real-time postback
 *
 *  Public:
 *    GET  /api/bootstrap             Stores + deals + leaderboard (frontend-shaped)
 *    GET  /api/stores  /api/deals    Filterable lists
 *
 *  Auth'd user:
 *    POST /api/auth/register|login   GET /api/user/me
 *    POST /api/orders                POST /api/orders/:id/receipt|escalate
 *    POST /api/claims                POST /api/withdraw
 *    POST /api/favorites/toggle      PUT  /api/profile   PUT /api/password
 *    POST /api/notifications/read
 *
 *  Admin:
 *    GET    /api/admin/overview
 *    POST   /api/admin/orders/:id/advance
 *    POST   /api/admin/claims/:id        { action: investigate|approve|reject }
 *    POST   /api/admin/withdrawals/:id   { action: approve|reject }
 *    DELETE /api/admin/users/:id
 *    POST/PUT/DELETE /api/admin/stores[/:id]   /api/admin/deals[/:id]
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const cron    = require('node-cron');
const path    = require('path');

const db              = require('./db');
const amazonTracker   = require('./affiliate/amazon-tracker');
const flipkartTracker = require('./affiliate/flipkart-tracker');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_in_production';
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: IS_PROD
    ? ['https://indiaoffers.in', 'https://www.indiaoffers.in']
    : true,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(IS_PROD ? 'combined' : 'dev'));
app.use(express.static(path.join(__dirname, 'public')));

// Universal tracking pixel — merchants embed <script src="https://.../pixel.js?merchant=ID">
app.get('/pixel.js', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'tracking', 'pixel.js'));
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const today  = () => new Date().toISOString().slice(0, 10);
const uid    = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const dateOnly = v => {
  if (!v) return null;
  return String(v).slice(0, 10);
};

// Cookie options that work on localhost AND production
function clickCookieOpts(days) {
  const opts = {
    maxAge  : days * 24 * 60 * 60 * 1000,
    httpOnly: false,            // pixel.js must read it on merchant thank-you pages
    secure  : IS_PROD,
    sameSite: 'Lax'
  };
  if (IS_PROD) opts.domain = '.indiaoffers.in';
  return opts;
}

const NOTIF_ICONS = { cashback: '💰', tracking: '📦', withdrawal: '💸', referral: '👥', system: '🔔' };

// ── Row → frontend shapers (frontend rendering code depends on these names) ──
const shapeUser = (r, referralCount = 0) => ({
  id: r.id, name: r.name, email: r.email, phone: r.phone || '',
  wallet: Math.round(+r.wallet * 100) / 100, joined: dateOnly(r.joined),
  referrals: +referralCount, isAdmin: !!r.is_admin,
  referralCode: r.referral_code, totalEarned: Math.round(+r.total_earned * 100) / 100
});

const shapeStore = r => ({
  id: r.id, name: r.name, cashback: r.cashback_label || `${Math.round(r.cashback_rate * 100)}%`,
  cashbackRate: +r.cashback_rate, color: r.color, initial: r.initial,
  category: r.category, description: r.description || '',
  dealsCount: +r.deals_count, url: (r.affiliate_url || '').replace(/^https?:\/\//, ''),
  affiliateUrl: r.affiliate_url, affiliateType: r.affiliate_type,
  rating: +r.rating, totalUsers: +r.total_users
});

const shapeDeal = r => {
  let expiry = '30 days';
  if (r.expiry_date) {
    const days = Math.ceil((new Date(dateOnly(r.expiry_date)) - Date.now()) / 86400000);
    expiry = days <= 0 ? 'Expired' : days === 1 ? '1 day' : `${days} days`;
  }
  let howTo = [];
  try { howTo = r.how_to_get ? JSON.parse(r.how_to_get) : []; } catch (e) { howTo = String(r.how_to_get).split('\n').filter(Boolean); }
  const op = r.original_price != null ? +r.original_price : null;
  const dp = r.deal_price != null ? +r.deal_price : null;
  return {
    id: r.id, storeId: r.store_id, title: r.title, cat: r.category,
    cashback: r.cashback_label || `${Math.round((r.cashback_rate || 0.05) * 100)}%`,
    code: r.coupon_code, desc: r.description || '', expiry,
    badge: r.badge, image: r.image_url || undefined,
    trending: !!r.is_trending, expiring: !!r.is_expiring,
    type: r.deal_type, minOrder: +r.min_order, uses: +r.uses_count,
    originalPrice: op, dealPrice: dp,
    discountPct: (op && dp && op > dp) ? Math.round((1 - dp / op) * 100) : (+r.discount_pct || null),
    dealUrl: r.deal_url || null, howToGet: howTo
  };
};

const shapeBanner = r => ({
  id: r.id, title: r.title, subtitle: r.subtitle || '', image: r.image_url || null,
  bgColor: r.bg_color || '#2563eb', dealId: r.deal_id || null, storeId: r.store_id || null,
  sortOrder: +r.sort_order, active: !!r.is_active
});

const shapeOrder = r => ({
  id: r.id, userId: r.user_id, dealId: r.deal_id, storeId: r.store_id,
  orderNumber: r.order_number, orderAmount: +r.order_amount,
  cashbackAmount: +r.cashback_amount, status: r.status,
  orderDate: dateOnly(r.order_date) || dateOnly(r.created_at),
  trackDate: dateOnly(r.created_at), verifiedDate: dateOnly(r.verified_at),
  confirmedDate: dateOnly(r.confirmed_at), paidDate: dateOnly(r.paid_at),
  notes: r.admin_notes || '', receiptUploaded: !!r.receipt_url, source: r.source
});

const shapeClaim = r => ({
  id: r.id, userId: r.user_id, storeId: r.store_id, orderNumber: r.order_number,
  orderAmount: +r.order_amount, expectedCashback: +r.expected_cashback,
  orderDate: dateOnly(r.order_date), submittedDate: dateOnly(r.created_at),
  status: r.status, notes: r.notes || '', receiptUploaded: !!r.receipt_url
});

const shapeWithdrawal = r => ({
  id: r.id, userId: r.user_id, amount: +r.amount, method: r.method,
  status: r.status, date: dateOnly(r.created_at), details: r.details || ''
});

const shapeNotification = r => ({
  id: String(r.id), userId: r.user_id, title: r.title, message: r.message,
  type: r.type, time: String(r.created_at).slice(0, 16), read: !!r.is_read,
  icon: NOTIF_ICONS[r.type] || '🔔'
});

async function notify(userId, title, message, type = 'system') {
  await db.query(
    'INSERT INTO notifications (user_id, title, message, type, created_at) VALUES (?, ?, ?, ?, ?)',
    [userId, title, message, type, nowSql()]
  );
}

async function creditWallet(userId, amount) {
  await db.query(
    'UPDATE users SET wallet = wallet + ?, total_earned = total_earned + ? WHERE id = ?',
    [amount, amount, userId]
  );
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  TRACKING ROUTES
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /go/:store?url=ENCODED_URL&uid=USER_ID&deal=DEAL_ID
 * :store is a store id ('s1'), slug ('flipkart') or affiliate type ('amazon').
 */
app.get('/go/:store', async (req, res) => {
  const key = req.params.store;
  const { url: rawUrl, uid: userId, deal } = req.query;

  let store = null;
  try {
    const rows = await db.query(
      'SELECT * FROM stores WHERE id = ? OR slug = ? OR affiliate_type = ? LIMIT 1',
      [key, key, key]
    );
    store = rows[0] || null;
  } catch (err) {
    console.error('[Click] Store lookup failed:', err.message);
  }

  let dealRow = null;
  if (deal) {
    try {
      const dr = await db.query('SELECT deal_url FROM deals WHERE id = ?', [deal]);
      dealRow = dr[0] || null;
    } catch (e) { /* best effort */ }
  }
  const targetUrl = rawUrl || (dealRow && dealRow.deal_url) || (store && store.affiliate_url);
  if (!targetUrl) return res.status(400).send('Missing url');
  req.query.url = targetUrl; // tracker handlers read req.query.url

  // Count deal usage (best-effort)
  if (deal) db.query('UPDATE deals SET uses_count = uses_count + 1 WHERE id = ?', [deal]).catch(() => {});

  const type = store ? store.affiliate_type : key;
  const ctx = {
    storeKey : store ? store.id : key,
    ip       : req.ip,
    userAgent: req.headers['user-agent'] || '',
    referrer : req.headers.referer || '',
    cookieOpts: clickCookieOpts.bind(null)
  };

  if (type === 'amazon')   return amazonTracker.handleAmazonClick(req, res, db, ctx);
  if (type === 'flipkart') return flipkartTracker.handleFlipkartClick(req, res, db, ctx);

  // Generic redirect (direct/pixel/network stores)
  const clickId = uid(store ? store.id : key);
  try {
    await db.query(`
      INSERT INTO affiliate_clicks (id, user_id, deal_id, store, raw_url, tagged_url, ip_address, user_agent, referrer, clicked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [clickId, userId || null, deal || null, ctx.storeKey, targetUrl, targetUrl,
        ctx.ip, ctx.userAgent, ctx.referrer, nowSql()]);
  } catch (err) {
    console.error('[Click] DB failed:', err.message);
  }

  res.cookie('io_click', clickId, clickCookieOpts(30));
  res.redirect(302, targetUrl); // 302: never let browsers cache a tracking redirect
});

/**
 * Shared pixel-sale processor — used by POST /track/sale and GET /track/sale.gif
 */
async function processSale(payload) {
  const { merchantId, clickId, orderId, orderAmount, currency, url, ts } = payload;

  const merchants = await db.query(
    'SELECT * FROM merchants WHERE id = ? AND is_active = 1', [merchantId]
  );
  if (merchants.length === 0) {
    console.warn('[Pixel] Unknown merchant:', merchantId);
    return;
  }
  const merchant = merchants[0];

  // Idempotency
  const exists = await db.query(
    'SELECT id FROM pixel_sales WHERE order_id = ? AND merchant_id = ?', [orderId, merchantId]
  );
  if (exists.length > 0) return;

  // Attribute the sale to a click → user
  const clicks = await db.query(
    'SELECT user_id, deal_id FROM affiliate_clicks WHERE id = ?', [clickId || '']
  );
  const userId = clicks.length > 0 ? clicks[0].user_id : null;

  const amount   = parseFloat(orderAmount) || 0;
  const rate     = +merchant.cashback_rate || 0.05;
  const cashback = Math.round(amount * rate * 100) / 100;
  const saleTs   = ts ? new Date(+ts).toISOString().slice(0, 19).replace('T', ' ') : nowSql();

  await db.query(`
    INSERT INTO pixel_sales
      (merchant_id, click_id, order_id, order_amount, currency, cashback_amount,
       user_id, sale_url, sale_ts, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'tracking', ?)
  `, [merchantId, clickId || null, orderId, amount, currency || 'INR',
      cashback, userId, url || '', saleTs, nowSql()]);

  // Mirror into orders so the user (and admin) sees it in Order Tracking
  if (userId && merchant.store_id) {
    try {
      await db.query(`
        INSERT IGNORE INTO orders
          (id, user_id, store_id, deal_id, click_id, order_number, order_amount,
           cashback_amount, cashback_rate, order_date, source, status, admin_notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pixel', 'tracking', 'Auto-tracked via merchant pixel', ?)
      `, [uid('o'), userId, merchant.store_id, clicks[0].deal_id || null, clickId,
          orderId, amount, cashback, rate, today(), nowSql()]);
      await notify(userId, 'Purchase Tracked!',
        `Your order ${orderId} (₹${amount}) was tracked automatically. ₹${cashback} cashback pending.`, 'tracking');
    } catch (err) {
      console.error('[Pixel] Order mirror failed:', err.message);
    }
  }

  console.log(`[Pixel] Sale recorded: ${orderId} @ ${merchantId}, cashback ₹${cashback}, user ${userId || 'anonymous'}`);
}

app.post('/track/sale', async (req, res) => {
  const { merchantId, clickId, orderId } = req.body;
  if (!merchantId || !orderId) {
    return res.status(400).json({ error: 'Missing required fields (merchantId, orderId)' });
  }
  res.status(200).json({ status: 'ok', received: true }); // ACK fast, process async
  try { await processSale(req.body); }
  catch (err) { console.error('[Pixel] Processing error:', err.message); }
});

app.get('/track/sale.gif', async (req, res) => {
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' });
  res.send(gif);
  if (req.query.merchantId && req.query.orderId) {
    try { await processSale(req.query); }
    catch (err) { console.error('[Pixel GIF] Processing error:', err.message); }
  }
});

app.get('/postback/flipkart', (req, res) => flipkartTracker.handleFlipkartPostback(req, res, db));

// ════════════════════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════════════════════

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, isAdmin: !!user.is_admin }, JWT_SECRET, { expiresIn: '30d' });
}

app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone, password, referralCode } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const exists = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const hash     = await bcrypt.hash(password, 10);
    const userId   = uid('u');
    const userCode = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) + Math.floor(Math.random() * 90 + 10);
    let wallet     = 100; // welcome bonus

    let referrer = null;
    if (referralCode) {
      const rows = await db.query('SELECT id, name FROM users WHERE referral_code = ?', [referralCode]);
      if (rows.length > 0) { referrer = rows[0]; wallet += 100; }
    }

    await db.query(`
      INSERT INTO users (id, name, email, phone, password_hash, referral_code, wallet, total_earned, is_admin, joined, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `, [userId, name, email, phone || '', hash, userCode, wallet, today(), nowSql()]);

    if (referrer) {
      await creditWallet(referrer.id, 100);
      await db.query('INSERT INTO referrals (referrer_id, referred_id, bonus, date, created_at) VALUES (?, ?, 100, ?, ?)',
        [referrer.id, userId, today(), nowSql()]);
      await notify(referrer.id, 'Referral Bonus!', `${name} joined with your code. ₹100 added to your wallet.`, 'referral');
    }
    await notify(userId, 'Welcome to IndiaOffers! 🎉', `₹${wallet} welcome bonus added to your wallet.`, 'system');

    const rows = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    res.json({ success: true, token: signToken(rows[0]), user: shapeUser(rows[0]) });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const users = await db.query('SELECT * FROM users WHERE (email = ? OR phone = ?) AND is_active = 1', [email, email]);
    if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user  = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await db.query('UPDATE users SET last_login = ? WHERE id = ?', [nowSql(), user.id]);
    const refs = await db.query('SELECT COUNT(*) AS c FROM referrals WHERE referrer_id = ?', [user.id]);
    res.json({ success: true, token: signToken(user), user: shapeUser(user, refs[0].c) });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  PUBLIC CONTENT
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/bootstrap', async (req, res) => {
  try {
    const stores = await db.query('SELECT * FROM stores WHERE is_active = 1 ORDER BY total_users DESC');
    const deals  = await db.query(`
      SELECT * FROM deals WHERE is_active = 1
      ORDER BY is_trending DESC, uses_count DESC
    `);
    const banners = await db.query('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC');
    const leaders = await db.query(`
      SELECT u.id, u.name, u.joined, u.total_earned,
             (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = u.id) AS referral_count
      FROM users u WHERE u.is_admin = 0 AND u.is_active = 1
      ORDER BY u.total_earned DESC LIMIT 20
    `);
    res.json({
      stores: stores.map(shapeStore),
      deals : deals.map(shapeDeal),
      banners: banners.map(shapeBanner),
      leaderboard: leaders.map(r => ({
        id: r.id, name: r.name, joined: dateOnly(r.joined),
        referrals: +r.referral_count, totalEarned: +r.total_earned, isAdmin: false
      }))
    });
  } catch (err) {
    console.error('[Bootstrap] error:', err.message);
    res.status(500).json({ error: 'Failed to load data' });
  }
});

app.get('/api/stores', async (req, res) => {
  try {
    const stores = await db.query('SELECT * FROM stores WHERE is_active = 1 ORDER BY total_users DESC');
    res.json({ stores: stores.map(shapeStore) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stores' });
  }
});

app.get('/api/deals', async (req, res) => {
  const { cat, store, q, page = 1, limit = 50 } = req.query;
  let where = 'WHERE d.is_active = 1';
  const params = [];
  if (cat && cat !== 'all') { where += ' AND d.category = ?'; params.push(cat); }
  if (store)                { where += ' AND d.store_id = ?'; params.push(store); }
  if (q)                    { where += ' AND (d.title LIKE ? OR d.description LIKE ? OR d.coupon_code LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  try {
    const deals = await db.query(
      `SELECT d.* FROM deals d ${where}
       ORDER BY d.is_trending DESC, d.uses_count DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), (parseInt(page, 10) - 1) * parseInt(limit, 10)]
    );
    res.json({ deals: deals.map(shapeDeal), page: +page, limit: +limit });
  } catch (err) {
    console.error('[Deals] error:', err.message);
    res.status(500).json({ error: 'Failed to load deals' });
  }
});

app.get('/api/deals/:id', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM deals WHERE id = ? AND is_active = 1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Deal not found' });
    const stores = await db.query('SELECT * FROM stores WHERE id = ?', [rows[0].store_id]);
    const related = await db.query(
      'SELECT * FROM deals WHERE store_id = ? AND id != ? AND is_active = 1 LIMIT 4',
      [rows[0].store_id, req.params.id]);
    res.json({
      deal: shapeDeal(rows[0]),
      store: stores.length ? shapeStore(stores[0]) : null,
      related: related.map(shapeDeal)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load deal' });
  }
});

app.get('/api/banners', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC');
    res.json({ banners: rows.map(shapeBanner) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load banners' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1 AS ok');
    res.json({ status: 'ok', driver: db.driver, time: nowSql() });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  USER
// ════════════════════════════════════════════════════════════════════════════

/** Everything the logged-in user's views need, frontend-shaped, in one call. */
app.get('/api/user/me', authMiddleware, async (req, res) => {
  try {
    const users = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });

    const [orders, claims, withdrawals, favorites, referrals, notifications, refCount] = await Promise.all([
      db.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]),
      db.query('SELECT * FROM claims WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]),
      db.query('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]),
      db.query('SELECT user_id, deal_id FROM favorites WHERE user_id = ?', [req.user.id]),
      db.query(`SELECT r.*, u.name AS referred_name FROM referrals r
                LEFT JOIN users u ON u.id = r.referred_id
                WHERE r.referrer_id = ? ORDER BY r.created_at ASC`, [req.user.id]),
      db.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]),
      db.query('SELECT COUNT(*) AS c FROM referrals WHERE referrer_id = ?', [req.user.id])
    ]);

    res.json({
      user: shapeUser(users[0], refCount[0].c),
      orders: orders.map(shapeOrder),
      claims: claims.map(shapeClaim),
      withdrawals: withdrawals.map(shapeWithdrawal),
      favorites: favorites.map(f => ({ userId: f.user_id, dealId: f.deal_id })),
      referrals: referrals.map(r => ({
        id: String(r.id), referrerId: r.referrer_id, referredId: r.referred_id,
        referredName: r.referred_name || 'Friend', bonus: +r.bonus, date: dateOnly(r.date)
      })),
      notifications: notifications.map(shapeNotification)
    });
  } catch (err) {
    console.error('[Me] error:', err.message);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

/** Manual order tracking submission */
app.post('/api/orders', authMiddleware, async (req, res) => {
  const { storeId, dealId, orderNumber, orderAmount, orderDate, couponUsed, receiptUploaded } = req.body;
  if (!storeId || !orderNumber || !orderAmount) return res.status(400).json({ error: 'Missing fields' });

  try {
    const stores = await db.query('SELECT * FROM stores WHERE id = ?', [storeId]);
    if (stores.length === 0) return res.status(404).json({ error: 'Store not found' });

    const dup = await db.query(
      'SELECT id FROM orders WHERE user_id = ? AND store_id = ? AND order_number = ?',
      [req.user.id, storeId, orderNumber]
    );
    if (dup.length > 0) return res.status(409).json({ error: 'This order is already being tracked' });

    const rate     = +stores[0].cashback_rate || 0.05;
    const cashback = Math.round(orderAmount * rate * 100) / 100;
    const orderId  = uid('o');

    await db.query(`
      INSERT INTO orders
        (id, user_id, store_id, deal_id, order_number, order_amount, cashback_amount,
         cashback_rate, coupon_used, order_date, source, status, receipt_url, admin_notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'pending', ?, ?, ?)
    `, [orderId, req.user.id, storeId, dealId || null, orderNumber, orderAmount, cashback,
        rate, couponUsed || '', orderDate || today(),
        receiptUploaded ? 'uploaded' : null,
        `Manual submission. Coupon: ${couponUsed || 'None'}`, nowSql()]);

    await notify(req.user.id, 'Order Submitted', `Order ${orderNumber} submitted for tracking.`, 'tracking');

    const rows = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.json({ success: true, order: shapeOrder(rows[0]) });
  } catch (err) {
    console.error('[Orders] submit error:', err.message);
    res.status(500).json({ error: 'Failed to submit order' });
  }
});

app.post('/api/orders/:id/receipt', authMiddleware, async (req, res) => {
  try {
    const rows = await db.query('SELECT admin_notes FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    await db.query(
      `UPDATE orders SET receipt_url = 'uploaded', admin_notes = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      [`${rows[0].admin_notes || ''} | Receipt uploaded`, nowSql(), req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update receipt' });
  }
});

app.post('/api/orders/:id/escalate', authMiddleware, async (req, res) => {
  const { issueType, description } = req.body;
  if (!description) return res.status(400).json({ error: 'Description required' });
  try {
    const rows = await db.query('SELECT admin_notes FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    await db.query(
      `UPDATE orders SET status = 'disputed', admin_notes = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      [`${rows[0].admin_notes || ''} | Escalated: ${issueType || 'Other'} - ${description}`, nowSql(), req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to escalate' });
  }
});

app.post('/api/claims', authMiddleware, async (req, res) => {
  const { storeId, orderNumber, orderAmount, orderDate, expectedCashback, notes, receiptUploaded } = req.body;
  if (!orderNumber || !orderAmount || !orderDate || !expectedCashback) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const claimId = uid('cl');
    await db.query(`
      INSERT INTO claims (id, user_id, store_id, order_number, order_amount, expected_cashback,
                          order_date, notes, receipt_url, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [claimId, req.user.id, storeId || null, orderNumber, orderAmount, expectedCashback,
        orderDate, notes || '', receiptUploaded ? 'uploaded' : null, nowSql()]);

    const rows = await db.query('SELECT * FROM claims WHERE id = ?', [claimId]);
    res.json({ success: true, claim: shapeClaim(rows[0]) });
  } catch (err) {
    console.error('[Claims] error:', err.message);
    res.status(500).json({ error: 'Failed to submit claim' });
  }
});

app.post('/api/withdraw', authMiddleware, async (req, res) => {
  const { amount, method, details } = req.body;
  const amt = parseFloat(amount);
  if (!amt || amt < 250) return res.status(400).json({ error: 'Minimum withdrawal ₹250' });
  if (!details) return res.status(400).json({ error: 'Account details required' });

  try {
    // Atomic guard: only deduct if balance is sufficient
    const r = await db.query(
      'UPDATE users SET wallet = wallet - ? WHERE id = ? AND wallet >= ?',
      [amt, req.user.id, amt]
    );
    if (!r.affectedRows) return res.status(400).json({ error: 'Insufficient balance' });

    const wid = uid('w');
    await db.query(`
      INSERT INTO withdrawals (id, user_id, amount, method, details, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `, [wid, req.user.id, amt, method || 'Bank Transfer', details, nowSql()]);

    await notify(req.user.id, 'Withdrawal Requested', `₹${amt} withdrawal via ${method}. Processing in 24-48 hours.`, 'withdrawal');

    const users = await db.query('SELECT wallet FROM users WHERE id = ?', [req.user.id]);
    res.json({ success: true, withdrawalId: wid, wallet: +users[0].wallet });
  } catch (err) {
    console.error('[Withdraw] error:', err.message);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});

app.post('/api/favorites/toggle', authMiddleware, async (req, res) => {
  const { dealId } = req.body;
  if (!dealId) return res.status(400).json({ error: 'dealId required' });
  try {
    const exists = await db.query('SELECT deal_id FROM favorites WHERE user_id = ? AND deal_id = ?', [req.user.id, dealId]);
    if (exists.length > 0) {
      await db.query('DELETE FROM favorites WHERE user_id = ? AND deal_id = ?', [req.user.id, dealId]);
      return res.json({ success: true, favorited: false });
    }
    await db.query('INSERT INTO favorites (user_id, deal_id, created_at) VALUES (?, ?, ?)', [req.user.id, dealId, nowSql()]);
    res.json({ success: true, favorited: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

app.put('/api/profile', authMiddleware, async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  try {
    const clash = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
    if (clash.length > 0) return res.status(409).json({ error: 'Email already in use' });
    await db.query('UPDATE users SET name = ?, email = ?, phone = ?, updated_at = ? WHERE id = ?',
      [name, email, phone || '', nowSql(), req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.put('/api/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  try {
    const users = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
    await db.query('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      [await bcrypt.hash(newPassword, 10), nowSql(), req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

app.post('/api/notifications/read', authMiddleware, async (req, res) => {
  const { id } = req.body; // omit id => mark all
  try {
    if (id) await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.user.id]);
    else    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN
// ════════════════════════════════════════════════════════════════════════════

app.get('/api/admin/overview', adminMiddleware, async (req, res) => {
  try {
    const [users, orders, claims, withdrawals, clicks, pixelSales, refCounts] = await Promise.all([
      db.query('SELECT * FROM users WHERE is_active = 1 ORDER BY created_at ASC'),
      db.query('SELECT * FROM orders ORDER BY created_at ASC'),
      db.query('SELECT * FROM claims ORDER BY created_at ASC'),
      db.query('SELECT * FROM withdrawals ORDER BY created_at ASC'),
      db.query('SELECT COUNT(*) AS c FROM affiliate_clicks'),
      db.query('SELECT COUNT(*) AS c, COALESCE(SUM(order_amount),0) AS gmv FROM pixel_sales'),
      db.query('SELECT referrer_id, COUNT(*) AS c FROM referrals GROUP BY referrer_id')
    ]);
    const allBanners = await db.query('SELECT * FROM banners ORDER BY sort_order ASC');
    const refMap = Object.fromEntries(refCounts.map(r => [r.referrer_id, r.c]));
    res.json({
      users: users.map(u => shapeUser(u, refMap[u.id] || 0)),
      orders: orders.map(shapeOrder),
      claims: claims.map(shapeClaim),
      withdrawals: withdrawals.map(shapeWithdrawal),
      banners: allBanners.map(shapeBanner),
      stats: { totalClicks: +clicks[0].c, pixelSales: +pixelSales[0].c, pixelGmv: +pixelSales[0].gmv }
    });
  } catch (err) {
    console.error('[Admin] overview error:', err.message);
    res.status(500).json({ error: 'Failed to load admin data' });
  }
});

/** Advance order along pending → tracking → verified → confirmed → paid.
 *  Wallet is credited when the order becomes 'confirmed'. */
app.post('/api/admin/orders/:id/advance', adminMiddleware, async (req, res) => {
  const FLOW = ['pending', 'tracking', 'verified', 'confirmed', 'paid'];
  try {
    const rows = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = rows[0];

    const idx = FLOW.indexOf(order.status);
    if (idx === -1 || idx === FLOW.length - 1) return res.status(400).json({ error: 'Order already at final status' });
    const next = FLOW[idx + 1];

    const stamps = { verified: 'verified_at', confirmed: 'confirmed_at', paid: 'paid_at' };
    const stampCol = stamps[next] ? `, ${stamps[next]} = ?` : '';
    await db.query(`UPDATE orders SET status = ?${stampCol}, updated_at = ? WHERE id = ?`,
      stamps[next] ? [next, nowSql(), nowSql(), req.params.id] : [next, nowSql(), req.params.id]);

    if (next === 'confirmed') {
      await creditWallet(order.user_id, +order.cashback_amount);
      await notify(order.user_id, 'Cashback Confirmed! 🎉',
        `₹${order.cashback_amount} from order ${order.order_number} added to your wallet.`, 'cashback');
    } else {
      await notify(order.user_id, `Order ${next.charAt(0).toUpperCase() + next.slice(1)}`,
        `Your order ${order.order_number} is now ${next}.`, 'tracking');
    }

    const updated = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true, order: shapeOrder(updated[0]) });
  } catch (err) {
    console.error('[Admin] advance error:', err.message);
    res.status(500).json({ error: 'Action failed' });
  }
});

app.post('/api/admin/claims/:id', adminMiddleware, async (req, res) => {
  const { action } = req.body; // investigate | approve | reject
  const map = { investigate: 'investigating', approve: 'approved', reject: 'rejected' };
  const status = map[action];
  if (!status) return res.status(400).json({ error: 'Invalid action' });

  try {
    const rows = await db.query('SELECT * FROM claims WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Claim not found' });
    const claim = rows[0];

    await db.query('UPDATE claims SET status = ? WHERE id = ?', [status, req.params.id]);

    if (action === 'approve') {
      await creditWallet(claim.user_id, +claim.expected_cashback);
      await notify(claim.user_id, 'Claim Approved! 🎉',
        `₹${claim.expected_cashback} for order ${claim.order_number} credited to your wallet.`, 'cashback');
    } else if (action === 'reject') {
      await notify(claim.user_id, 'Claim Update',
        `Your claim for order ${claim.order_number} could not be verified.`, 'system');
    }
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: 'Action failed' });
  }
});

app.post('/api/admin/withdrawals/:id', adminMiddleware, async (req, res) => {
  const { action } = req.body; // approve | reject
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

  try {
    const rows = await db.query('SELECT * FROM withdrawals WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Withdrawal not found' });
    const wd = rows[0];
    if (wd.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

    const status = action === 'approve' ? 'approved' : 'rejected';
    await db.query('UPDATE withdrawals SET status = ?, processed_at = ? WHERE id = ?', [status, nowSql(), req.params.id]);

    if (action === 'reject') {
      // refund (amount was deducted at request time)
      await db.query('UPDATE users SET wallet = wallet + ? WHERE id = ?', [+wd.amount, wd.user_id]);
      await notify(wd.user_id, 'Withdrawal Rejected', `₹${wd.amount} refunded to your wallet.`, 'withdrawal');
    } else {
      await notify(wd.user_id, 'Withdrawal Approved! 💸', `₹${wd.amount} sent via ${wd.method}.`, 'withdrawal');
    }
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: 'Action failed' });
  }
});

app.delete('/api/admin/users/:id', adminMiddleware, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    const r = await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ── Admin: store & deal management ───────────────────────────────────────────
app.post('/api/admin/stores', adminMiddleware, async (req, res) => {
  const { name, category, cashback, color, description } = req.body;
  if (!name || !cashback) return res.status(400).json({ error: 'Name and cashback required' });
  try {
    const id   = uid('s');
    const rate = (parseFloat(cashback) || 5) / 100;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await db.query(`
      INSERT INTO stores (id, name, slug, description, color, initial, category, cashback_rate, cashback_label,
                          affiliate_url, affiliate_type, is_active, rating)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'direct', 1, 4.0)
    `, [id, name, slug, description || '', color || '#00a86b', name.charAt(0).toUpperCase(),
        category || 'shopping', rate, cashback.includes('%') ? cashback : `${cashback}%`,
        `https://www.${slug.replace(/-/g, '')}.com`]);
    const rows = await db.query('SELECT * FROM stores WHERE id = ?', [id]);
    res.json({ success: true, store: shapeStore(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add store' });
  }
});

app.put('/api/admin/stores/:id', adminMiddleware, async (req, res) => {
  const { name, cashback, rating, description } = req.body;
  try {
    const rate = cashback ? (parseFloat(cashback) || 5) / 100 : null;
    await db.query(`
      UPDATE stores SET
        name = COALESCE(?, name), description = COALESCE(?, description),
        rating = COALESCE(?, rating),
        cashback_rate = COALESCE(?, cashback_rate), cashback_label = COALESCE(?, cashback_label)
      WHERE id = ?
    `, [name || null, description || null, rating || null, rate,
        cashback ? (String(cashback).includes('%') ? cashback : `${cashback}%`) : null, req.params.id]);
    const rows = await db.query('SELECT * FROM stores WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Store not found' });
    res.json({ success: true, store: shapeStore(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update store' });
  }
});

app.delete('/api/admin/stores/:id', adminMiddleware, async (req, res) => {
  try {
    await db.query('UPDATE deals SET is_active = 0 WHERE store_id = ?', [req.params.id]);
    await db.query('UPDATE stores SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete store' });
  }
});

app.post('/api/admin/deals', adminMiddleware, async (req, res) => {
  const { storeId, title, cat, code, cashback, desc, badge, expiryDays, minOrder,
          imageUrl, originalPrice, dealPrice, dealUrl, howToGet, dealType, trending } = req.body;
  if (!storeId || !title) return res.status(400).json({ error: 'Store and title required' });
  try {
    const stores = await db.query('SELECT * FROM stores WHERE id = ?', [storeId]);
    if (stores.length === 0) return res.status(404).json({ error: 'Store not found' });
    const id = uid('d');
    const rate = cashback ? (parseFloat(cashback) || 5) / 100 : +stores[0].cashback_rate;
    const label = cashback ? (String(cashback).includes('%') ? cashback : `${cashback}%`) : stores[0].cashback_label;
    const exp = new Date(); exp.setDate(exp.getDate() + (parseInt(expiryDays, 10) || 7));
    const steps = Array.isArray(howToGet) ? howToGet : String(howToGet || '').split('\n').map(t => t.trim()).filter(Boolean);

    await db.query(`
      INSERT INTO deals (id, store_id, title, description, coupon_code, deal_type, category,
                         cashback_rate, cashback_label, min_order, badge,
                         original_price, deal_price, deal_url, how_to_get, image_url,
                         is_trending, is_active, expiry_date, start_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `, [id, storeId, title, desc || '', (code || '').toUpperCase() || null, dealType || 'deal',
        cat || stores[0].category, rate, label, parseFloat(minOrder) || 0, badge || 'NEW',
        originalPrice != null && originalPrice !== '' ? parseFloat(originalPrice) : null,
        dealPrice != null && dealPrice !== '' ? parseFloat(dealPrice) : null,
        dealUrl || null, JSON.stringify(steps), imageUrl || null,
        trending ? 1 : 0, exp.toISOString().slice(0, 10), today(), nowSql()]);
    await db.query('UPDATE stores SET deals_count = deals_count + 1 WHERE id = ?', [storeId]);

    const rows = await db.query('SELECT * FROM deals WHERE id = ?', [id]);
    res.json({ success: true, deal: shapeDeal(rows[0]) });
  } catch (err) {
    console.error('[Admin] add deal error:', err.message);
    res.status(500).json({ error: 'Failed to add deal' });
  }
});

app.put('/api/admin/deals/:id', adminMiddleware, async (req, res) => {
  const { title, code, cashback, desc, imageUrl, originalPrice, dealPrice, dealUrl, howToGet, badge, trending } = req.body;
  try {
    const steps = howToGet === undefined ? null
      : JSON.stringify(Array.isArray(howToGet) ? howToGet : String(howToGet).split('\n').map(t => t.trim()).filter(Boolean));
    await db.query(`
      UPDATE deals SET
        title = COALESCE(?, title), coupon_code = COALESCE(?, coupon_code),
        description = COALESCE(?, description),
        cashback_label = COALESCE(?, cashback_label),
        image_url = COALESCE(?, image_url),
        original_price = COALESCE(?, original_price),
        deal_price = COALESCE(?, deal_price),
        deal_url = COALESCE(?, deal_url),
        how_to_get = COALESCE(?, how_to_get),
        badge = COALESCE(?, badge),
        is_trending = COALESCE(?, is_trending),
        updated_at = ?
      WHERE id = ?
    `, [title || null, code ? code.toUpperCase() : null, desc || null,
        cashback ? (String(cashback).includes('%') ? cashback : `${cashback}%`) : null,
        imageUrl || null,
        originalPrice != null && originalPrice !== '' ? parseFloat(originalPrice) : null,
        dealPrice != null && dealPrice !== '' ? parseFloat(dealPrice) : null,
        dealUrl || null, steps, badge || null,
        trending === undefined ? null : (trending ? 1 : 0),
        nowSql(), req.params.id]);
    const rows = await db.query('SELECT * FROM deals WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Deal not found' });
    res.json({ success: true, deal: shapeDeal(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

app.delete('/api/admin/deals/:id', adminMiddleware, async (req, res) => {
  try {
    await db.query('UPDATE deals SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

// ── Admin: banner management ──────────────────────────────────────────────────
app.post('/api/admin/banners', adminMiddleware, async (req, res) => {
  const { title, subtitle, imageUrl, bgColor, dealId, storeId, sortOrder } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  try {
    const id = uid('b');
    await db.query(`
      INSERT INTO banners (id, title, subtitle, image_url, bg_color, deal_id, store_id, sort_order, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `, [id, title, subtitle || '', imageUrl || null, bgColor || '#2563eb',
        dealId || null, storeId || null, parseInt(sortOrder, 10) || 0, nowSql()]);
    const rows = await db.query('SELECT * FROM banners WHERE id = ?', [id]);
    res.json({ success: true, banner: shapeBanner(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add banner' });
  }
});

app.put('/api/admin/banners/:id', adminMiddleware, async (req, res) => {
  const { title, subtitle, imageUrl, bgColor, dealId, storeId, sortOrder, active } = req.body;
  try {
    await db.query(`
      UPDATE banners SET
        title = COALESCE(?, title), subtitle = COALESCE(?, subtitle),
        image_url = COALESCE(?, image_url), bg_color = COALESCE(?, bg_color),
        deal_id = COALESCE(?, deal_id), store_id = COALESCE(?, store_id),
        sort_order = COALESCE(?, sort_order),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `, [title || null, subtitle || null, imageUrl || null, bgColor || null,
        dealId || null, storeId || null,
        sortOrder === undefined ? null : parseInt(sortOrder, 10),
        active === undefined ? null : (active ? 1 : 0), req.params.id]);
    const rows = await db.query('SELECT * FROM banners WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Banner not found' });
    res.json({ success: true, banner: shapeBanner(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update banner' });
  }
});

app.delete('/api/admin/banners/:id', adminMiddleware, async (req, res) => {
  try {
    await db.query('DELETE FROM banners WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete banner' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  CRON JOBS
// ════════════════════════════════════════════════════════════════════════════

// Daily Amazon report reconciliation at 06:30 IST.
// Amazon has no realtime postback — download the Associates earnings CSV
// (Playwright or report-by-email) and feed it to reconcileAmazonOrders().
cron.schedule('30 6 * * *', async () => {
  console.log('[Cron] Amazon reconciliation: no report source configured yet.');
  // const csvText = await downloadAmazonReport();
  // const orders  = amazonTracker.parseAmazonEarningsReport(csvText);
  // await amazonTracker.reconcileAmazonOrders(orders, db);
}, { timezone: 'Asia/Kolkata' });

// Auto-confirm verified orders older than 30 days (return period passed) and credit wallets
cron.schedule('0 2 * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const due = await db.query(
      `SELECT * FROM orders WHERE status = 'verified' AND created_at < ?`, [cutoff]
    );
    for (const order of due) {
      await db.query(`UPDATE orders SET status = 'confirmed', confirmed_at = ?, updated_at = ? WHERE id = ?`,
        [nowSql(), nowSql(), order.id]);
      await creditWallet(order.user_id, +order.cashback_amount);
      await notify(order.user_id, 'Cashback Confirmed! 🎉',
        `₹${order.cashback_amount} from order ${order.order_number} added to your wallet.`, 'cashback');
    }
    if (due.length) console.log(`[Cron] Auto-confirmed ${due.length} orders`);
  } catch (err) {
    console.error('[Cron] Auto-confirm failed:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ════════════════════════════════════════════════════════════════════════════
//  SPA FALLBACK + START
// ════════════════════════════════════════════════════════════════════════════

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/go/') ||
      req.path.startsWith('/track/') || req.path.startsWith('/postback/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════════╗
  ║  🇮🇳  IndiaOffers.in  API Server           ║
  ║  Port : ${String(PORT).padEnd(33)}║
  ║  ENV  : ${String(process.env.NODE_ENV || 'development').padEnd(33)}║
  ║  DB   : ${String(db.driver).padEnd(33)}║
  ╚══════════════════════════════════════════╝
    `);
  });
}

module.exports = app;
