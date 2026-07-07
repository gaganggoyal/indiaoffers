'use strict';

/**
 * Admin panel — server-rendered, form-POST based (no client framework).
 * Login sets an httpOnly JWT cookie; everything under /admin requires it.
 */

const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { adminAuth, signAdmin, sessionCookie, clearOpts } = require('../middleware/auth');
const { savingsStack, activeBankOffers } = require('../services/savings');
const { generateCardOfferAlerts } = require('../services/alerts');
const { deliverPendingAlerts } = require('../services/alertSender');
const { mailerMode, verifyTransport } = require('../services/mailer');
const { entityList, templateCsv, importCsv } = require('../services/importer');
const { buildFromLink, geminiConfigured } = require('../services/quickdeal');
const { CATEGORIES, CAT_NAMES } = require('../data/taxonomy');

const { uid, slugify, nowSql } = db;

// newline-separated textarea → JSON array of trimmed non-empty lines
const linesToJson = v => JSON.stringify(String(v || '').split('\n').map(s => s.trim()).filter(Boolean));

// ── Auth ──────────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => res.render('admin/login', { title: 'Admin Login', error: null }));

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const rows = await db.query('SELECT * FROM admins WHERE email = ?', [email || '']);
  if (rows.length === 0 || !(await bcrypt.compare(password || '', rows[0].password_hash))) {
    return res.status(401).render('admin/login', { title: 'Admin Login', error: 'Invalid credentials' });
  }
  await db.query('UPDATE admins SET last_login = ? WHERE id = ?', [nowSql(), rows[0].id]);
  res.cookie('io_admin', signAdmin(rows[0]), sessionCookie(7 * 864e5));
  res.redirect('/admin');
});

router.post('/logout', (req, res) => { res.clearCookie('io_admin', clearOpts()); res.redirect('/admin/login'); });

router.use(adminAuth);

// ── Image uploads ───────────────────────────────────────────────────────────────
// Admin can upload an image file instead of pasting a URL. Files land in
// public/uploads/ and are served at /uploads/<name>; the JSON { url } response
// is dropped into the matching URL field by the form's upload widget.
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif' };
const uploadImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = ALLOWED_EXT[file.mimetype] || (path.extname(file.originalname).toLowerCase().match(/^\.[a-z0-9]{1,5}$/) || ['.jpg'])[0];
      cb(null, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },        // 5 MB
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
}).single('file');

router.post('/upload', (req, res) => {
  uploadImage(req, res, err => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image too large (max 5 MB)' : 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'Please choose an image file' });
    res.json({ url: '/uploads/' + req.file.filename });
  });
});

// ── CSV bulk import ─────────────────────────────────────────────────────────
// Admin uploads a spreadsheet to create/update stores, deals, bank offers,
// coupons or bank cards in one go. See src/services/importer.js for the rules.
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },          // 8 MB
  fileFilter: (req, file, cb) => cb(null, /csv|excel|spreadsheet|text\/plain|octet-stream/.test(file.mimetype) || /\.csv$/i.test(file.originalname))
}).single('file');

router.get('/import', (req, res) => {
  res.render('admin/import', { title: 'Admin — CSV Import', admin: req.admin, section: 'import', entities: entityList(), result: null, error: null, chosen: req.query.type || 'deals' });
});

router.get('/import/:entity/template.csv', (req, res) => {
  try {
    const csv = templateCsv(req.params.entity);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.entity}-template.csv"`);
    res.send(csv);
  } catch (e) { res.status(404).send('Unknown template'); }
});

router.post('/import/:entity', (req, res) => {
  uploadCsv(req, res, async err => {
    const view = (extra) => res.render('admin/import', Object.assign({ title: 'Admin — CSV Import', admin: req.admin, section: 'import', entities: entityList(), result: null, error: null, chosen: req.params.entity }, extra));
    try {
      if (err) return view({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 8 MB)' : 'Upload failed' });
      if (!req.file) return view({ error: 'Please choose a .csv file to upload' });
      const text = req.file.buffer.toString('utf8');
      const result = await importCsv(req.params.entity, text);
      view({ result });
    } catch (e) { view({ error: e.message }); }
  });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const [deals, offers, cards, guides, coupons, stores, users, clicks, topDeals] = await Promise.all([
      db.query('SELECT COUNT(*) AS c FROM deals WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS c FROM bank_offers WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS c FROM bank_cards WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS c FROM guides WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS c FROM coupons WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS c FROM stores WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS c FROM users WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS c FROM clicks'),
      db.query('SELECT id, title, clicks FROM deals ORDER BY clicks DESC LIMIT 8')
    ]);
    res.render('admin/dashboard', {
      title: 'Admin — Dashboard', admin: req.admin, section: 'dashboard',
      stats: { deals: deals[0].c, offers: offers[0].c, cards: cards[0].c, guides: guides[0].c,
               coupons: coupons[0].c, stores: stores[0].c, users: users[0].c, clicks: clicks[0].c },
      topDeals
    });
  } catch (err) { next(err); }
});

// ── Generic list/save/delete helpers per entity ──────────────────────────────
const boolInt = v => (v === 'on' || v === '1' || v === 1 || v === true) ? 1 : 0;
const numOrNull = v => (v === undefined || v === null || v === '') ? null : parseFloat(v);

/**
 * Build a portable WHERE clause + params for an admin list page from query
 * params, plus an `active` map echoing the chosen values back to the view.
 * spec: { search:['col',…], eq:{ param:'col' }, bool:{ param:'col' } }
 *   - search: case-insensitive LIKE across the given columns (q param)
 *   - eq:     exact match when the param is non-empty
 *   - bool:   'live'/'1' → col=1, 'hidden'/'off'/'0' → col=0
 */
function listFilter(query, spec) {
  const where = [], params = [], active = {};
  const q = String(query.q || '').trim();
  active.q = q;
  if (q && spec.search && spec.search.length) {
    where.push('(' + spec.search.map(c => `${c} LIKE ?`).join(' OR ') + ')');
    spec.search.forEach(() => params.push('%' + q + '%'));
  }
  for (const [p, col] of Object.entries(spec.eq || {})) {
    const v = query[p] == null ? '' : String(query[p]);
    active[p] = v;
    if (v !== '') { where.push(`${col} = ?`); params.push(v); }
  }
  for (const [p, col] of Object.entries(spec.bool || {})) {
    const v = query[p] == null ? '' : String(query[p]);
    active[p] = v;
    if (v === 'live' || v === '1' || v === 'yes') where.push(`${col} = 1`);
    else if (v === 'hidden' || v === 'off' || v === '0' || v === 'no') where.push(`${col} = 0`);
  }
  // Expiry-date filter (col holds a DATE/DATETIME string). Thresholds are computed
  // here and bound as params so the comparison stays portable (sqlite + mysql).
  if (spec.expiry) {
    const col = spec.expiry;
    const v = query.expiry == null ? '' : String(query.expiry);
    active.expiry = v;
    const iso = ms => new Date(ms).toISOString().slice(0, 10);
    const today = iso(Date.now());
    const soonEnd = iso(Date.now() + 8 * 864e5);           // today + 7 days, inclusive
    if (v === 'expired')      { where.push(`(${col} IS NOT NULL AND ${col} <> '' AND ${col} < ?)`); params.push(today); }
    else if (v === 'soon')    { where.push(`(${col} >= ? AND ${col} < ?)`); params.push(today, soonEnd); }
    else if (v === 'active')  { where.push(`(${col} IS NULL OR ${col} = '' OR ${col} >= ?)`); params.push(today); }
    else if (v === 'none')    { where.push(`(${col} IS NULL OR ${col} = '')`); }
  }
  return { clause: where.length ? ' WHERE ' + where.join(' AND ') : '', params, active };
}
const STATUS_OPTS = [{ v: 'live', l: 'Live' }, { v: 'hidden', l: 'Hidden' }];
const EXPIRY_OPTS = [
  { v: 'active',  l: 'Active (not expired)' },
  { v: 'soon',    l: 'Expiring ≤ 7 days' },
  { v: 'expired', l: 'Expired' },
  { v: 'none',    l: 'No expiry date' }
];

// ── Quick add (Amazon link → live deal) ──────────────────────────────────────
// Admin pastes an Amazon link + MRP + deal price. We fetch the product title,
// tidy it with Gemini, prefix "[LOOT]" and publish the deal live in one step.
router.get('/quick-add', (req, res) => {
  res.render('admin/quick-add', {
    title: 'Admin — Quick Add', admin: req.admin, section: 'quick-add',
    ai: geminiConfigured(), result: null, error: null, form: {}
  });
});

router.post('/quick-add', async (req, res, next) => {
  const b = req.body || {};
  const view = extra => res.render('admin/quick-add', Object.assign(
    { title: 'Admin — Quick Add', admin: req.admin, section: 'quick-add', ai: geminiConfigured(), result: null, error: null, form: b }, extra));
  try {
    const url = String(b.url || '').trim();
    const price = numOrNull(b.price);
    const mrp = numOrNull(b.mrp);
    if (!url) return view({ error: 'Paste an Amazon product link first' });
    if (price == null || !(price > 0)) return view({ error: 'Enter a valid deal price' });
    if (mrp != null && mrp < price) return view({ error: 'MRP looks lower than the deal price — please check' });

    const info = await buildFromLink(url);              // { title, category, dealUrl, usedAi }
    const dealTitle = `[LOOT] ${info.title}`.slice(0, 160);
    const id = uid('dl');
    const slug = slugify(info.title || 'deal') + '-' + Math.random().toString(36).slice(2, 5);

    await db.query(`
      INSERT INTO deals (id, slug, store_id, title, description, category, image_url, mrp, price,
        coupon_code, deal_url, how_to, badge, cashback_text, is_trending, is_active, posted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [id, slug, 'st_amazon', dealTitle, '', info.category || '', info.image || null, mrp, price,
        null, info.dealUrl, '[]', null, null, 0, 1]);

    view({ result: {
      id, slug, title: dealTitle, category: info.category, categoryName: CAT_NAMES[info.category] || null,
      mrp, price, image: info.image, dealUrl: info.dealUrl, usedAi: info.usedAi
    } });
  } catch (err) {
    // Expected, user-fixable problems (bad link, robot-check, timeout) → show inline.
    if (err instanceof Error && err.message) return view({ error: err.message });
    next(err);
  }
});

// DEALS
router.get('/deals', async (req, res, next) => {
  try {
    const f = listFilter(req.query, {
      search: ['d.title', 'd.slug'],
      eq: { store: 'd.store_id', category: 'd.category' },
      bool: { status: 'd.is_active' },
      expiry: 'd.expiry_date'
    });
    const [deals, stores] = await Promise.all([
      db.query(`
        SELECT d.*, s.name AS store_name FROM deals d LEFT JOIN stores s ON s.id = d.store_id
        ${f.clause} ORDER BY d.posted_at DESC LIMIT 200`, f.params),
      db.query('SELECT id, name FROM stores ORDER BY name')
    ]);
    res.render('admin/deals', { title: 'Admin — Deals', admin: req.admin, section: 'deals',
      deals, stores, categories: CATEGORIES, active: f.active });
  } catch (err) { next(err); }
});

router.get('/deals/new', async (req, res, next) => {
  try {
    const stores = await db.query('SELECT id, name FROM stores WHERE is_active = 1 ORDER BY name');
    res.render('admin/deal-form', { title: 'Admin — New Deal', admin: req.admin, section: 'deals', deal: null, stores, categories: CATEGORIES });
  } catch (err) { next(err); }
});

router.get('/deals/:id/edit', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM deals WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/admin/deals');
    const stores = await db.query('SELECT id, name FROM stores WHERE is_active = 1 ORDER BY name');
    const offers = await activeBankOffers();
    res.render('admin/deal-form', {
      title: 'Admin — Edit Deal', admin: req.admin, section: 'deals',
      deal: rows[0], stores, categories: CATEGORIES, stack: savingsStack(rows[0], offers)
    });
  } catch (err) { next(err); }
});

router.post('/deals/save', async (req, res, next) => {
  try {
    const b = req.body;
    const howTo = JSON.stringify(String(b.how_to || '').split('\n').map(s => s.trim()).filter(Boolean));
    // Manual "Best way to pay" rows: zip the parallel sr_* arrays into objects.
    const toArr = v => v == null ? [] : (Array.isArray(v) ? v : [v]);
    const srBank = toArr(b['sr_bank']), srLabel = toArr(b['sr_label']),
          srSave = toArr(b['sr_saving']), srPromo = toArr(b['sr_promo']);
    const rows = srBank.map((_, i) => ({
      bank:  String(srBank[i]  || '').trim(),
      label: String(srLabel[i] || '').trim(),
      saving: Math.max(0, Math.round(+srSave[i] || 0)),
      promo: String(srPromo[i] || '').trim() || undefined
    })).filter(r => r.bank || r.label || r.saving > 0);
    const savingsRows = rows.length ? JSON.stringify(rows) : null;
    if (b.id) {
      await db.query(`
        UPDATE deals SET store_id=?, title=?, description=?, category=?, image_url=?, mrp=?, price=?,
          true_price=?, savings_note=?, savings_rows=?, coupon_code=?, deal_url=?, how_to=?, badge=?, cashback_text=?,
          is_trending=?, is_active=?, expiry_date=?, updated_at=?
        WHERE id=?
      `, [b.store_id, b.title, b.description || '', b.category || '', b.image_url || null,
          numOrNull(b.mrp), numOrNull(b.price), numOrNull(b.true_price), (b.savings_note || '').trim() || null, savingsRows,
          b.coupon_code || null, b.deal_url || null, howTo,
          b.badge || null, b.cashback_text || null, boolInt(b.is_trending), boolInt(b.is_active),
          b.expiry_date || null, nowSql(), b.id]);
    } else {
      await db.query(`
        INSERT INTO deals (id, slug, store_id, title, description, category, image_url, mrp, price,
          true_price, savings_note, savings_rows, coupon_code, deal_url, how_to, badge, cashback_text, is_trending, is_active, expiry_date, posted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [uid('dl'), slugify(b.title) + '-' + Math.random().toString(36).slice(2, 5), b.store_id, b.title,
          b.description || '', b.category || '', b.image_url || null, numOrNull(b.mrp), numOrNull(b.price),
          numOrNull(b.true_price), (b.savings_note || '').trim() || null, savingsRows,
          b.coupon_code || null, b.deal_url || null, howTo, b.badge || null, b.cashback_text || null,
          boolInt(b.is_trending), boolInt(b.is_active), b.expiry_date || null]);
    }
    res.redirect('/admin/deals');
  } catch (err) { next(err); }
});

router.post('/deals/:id/delete', async (req, res, next) => {
  try {
    await db.query('UPDATE deals SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.redirect('/admin/deals');
  } catch (err) { next(err); }
});

// BANK OFFERS
router.get('/bank-offers', async (req, res, next) => {
  try {
    const f = listFilter(req.query, {
      search: ['o.title', 'o.bank'],
      eq: { store: 'o.store_id' },
      bool: { status: 'o.is_active' },
      expiry: 'o.valid_till'
    });
    const [offers, stores] = await Promise.all([
      db.query(`
        SELECT o.*, s.name AS store_name FROM bank_offers o LEFT JOIN stores s ON s.id = o.store_id
        ${f.clause} ORDER BY o.created_at DESC`, f.params),
      db.query('SELECT id, name FROM stores ORDER BY name')
    ]);
    res.render('admin/bank-offers', { title: 'Admin — Bank Offers', admin: req.admin, section: 'bank-offers',
      offers, stores, active: f.active });
  } catch (err) { next(err); }
});

async function offerFormData() {
  const [stores, cards] = await Promise.all([
    db.query('SELECT id, name FROM stores WHERE is_active = 1 ORDER BY name'),
    db.query('SELECT id, name, bank FROM bank_cards WHERE is_active = 1 ORDER BY bank, name')
  ]);
  return { stores, cards };
}

router.get('/bank-offers/new', async (req, res, next) => {
  try {
    const { stores, cards } = await offerFormData();
    res.render('admin/bank-offer-form', { title: 'Admin — New Bank Offer', admin: req.admin, section: 'bank-offers', offer: null, stores, cards });
  } catch (err) { next(err); }
});

router.get('/bank-offers/:id/edit', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM bank_offers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/admin/bank-offers');
    const { stores, cards } = await offerFormData();
    res.render('admin/bank-offer-form', { title: 'Admin — Edit Bank Offer', admin: req.admin, section: 'bank-offers', offer: rows[0], stores, cards });
  } catch (err) { next(err); }
});

router.post('/bank-offers/save', async (req, res, next) => {
  try {
    const b = req.body;
    const id = b.id || uid('bo');
    const vals = [b.bank, b.instrument || 'credit', b.title, b.description || '',
      b.discount_type || 'percent', numOrNull(b.discount_value) || 0, numOrNull(b.max_discount),
      numOrNull(b.min_order) || 0, b.store_id || null, b.bank_card_id || null, b.promo_code || null,
      b.valid_from || null, b.valid_till || null, b.source_url || null, boolInt(b.is_active)];
    if (b.id) {
      await db.query(`
        UPDATE bank_offers SET bank=?, instrument=?, title=?, description=?, discount_type=?,
          discount_value=?, max_discount=?, min_order=?, store_id=?, bank_card_id=?, promo_code=?,
          valid_from=?, valid_till=?, source_url=?, is_active=? WHERE id=?
      `, [...vals, id]);
    } else {
      await db.query(`
        INSERT INTO bank_offers (bank, instrument, title, description, discount_type, discount_value,
          max_discount, min_order, store_id, bank_card_id, promo_code, valid_from, valid_till, source_url, is_active, id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [...vals, id]);
    }
    // Queue "sale on your card" alerts for holders of the targeted card
    let alertCount = 0;
    if (b.bank_card_id) {
      const saved = await db.query('SELECT * FROM bank_offers WHERE id = ?', [id]);
      if (saved[0]) alertCount = await generateCardOfferAlerts(saved[0]);
    }
    res.redirect('/admin/bank-offers' + (alertCount ? `?alerts=${alertCount}` : ''));
  } catch (err) { next(err); }
});

router.post('/bank-offers/:id/delete', async (req, res, next) => {
  try {
    await db.query('UPDATE bank_offers SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.redirect('/admin/bank-offers');
  } catch (err) { next(err); }
});

// STORES
router.get('/stores', async (req, res, next) => {
  try {
    const f = listFilter(req.query, { search: ['s.name', 's.slug'], eq: { category: 's.category' }, bool: { status: 's.is_active' } });
    const stores = await db.query(`
      SELECT s.*, (SELECT COUNT(*) FROM deals d WHERE d.store_id = s.id AND d.is_active = 1) AS deal_count
      FROM stores s${f.clause} ORDER BY s.name`, f.params);
    res.render('admin/stores', { title: 'Admin — Stores', admin: req.admin, section: 'stores', stores, active: f.active });
  } catch (err) { next(err); }
});

router.get('/stores/new', (req, res) =>
  res.render('admin/store-form', { title: 'Admin — New Store', admin: req.admin, section: 'stores', store: null }));

router.get('/stores/:id/edit', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM stores WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/admin/stores');
    res.render('admin/store-form', { title: 'Admin — Edit Store', admin: req.admin, section: 'stores', store: rows[0] });
  } catch (err) { next(err); }
});

router.post('/stores/save', async (req, res, next) => {
  try {
    const b = req.body;
    const affiliateParams = (b.affiliate_params || '').trim().replace(/^[?&]+/, '') || null;
    const affiliatePrefix = (b.affiliate_prefix || '').trim() || null;
    const vals = [b.name, b.color || '#4f46e5', b.logo_url || null, b.category || '', b.description || '',
      b.website_url || null, b.affiliate_url || b.website_url || null, b.affiliate_type || 'none',
      affiliateParams, affiliatePrefix, b.cashback_text || null, boolInt(b.is_active)];
    if (b.id) {
      await db.query(`
        UPDATE stores SET name=?, color=?, logo_url=?, category=?, description=?, website_url=?,
          affiliate_url=?, affiliate_type=?, affiliate_params=?, affiliate_prefix=?, cashback_text=?, is_active=? WHERE id=?
      `, [...vals, b.id]);
    } else {
      await db.query(`
        INSERT INTO stores (name, color, logo_url, category, description, website_url,
          affiliate_url, affiliate_type, affiliate_params, affiliate_prefix, cashback_text, is_active, id, slug)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [...vals, uid('st'), slugify(b.name)]);
    }
    res.redirect('/admin/stores');
  } catch (err) { next(err); }
});

router.post('/stores/:id/delete', async (req, res, next) => {
  try {
    await db.query('UPDATE stores SET is_active = 0 WHERE id = ?', [req.params.id]);
    await db.query('UPDATE deals SET is_active = 0 WHERE store_id = ?', [req.params.id]);
    res.redirect('/admin/stores');
  } catch (err) { next(err); }
});

// COUPONS
router.get('/coupons', async (req, res, next) => {
  try {
    const f = listFilter(req.query, {
      search: ['c.code', 'c.title'],
      eq: { store: 'c.store_id' },
      bool: { status: 'c.is_active', verified: 'c.is_verified' },
      expiry: 'c.expiry_date'
    });
    const [coupons, stores] = await Promise.all([
      db.query(`
        SELECT c.*, s.name AS store_name FROM coupons c LEFT JOIN stores s ON s.id = c.store_id
        ${f.clause} ORDER BY c.created_at DESC`, f.params),
      db.query('SELECT id, name FROM stores ORDER BY name')
    ]);
    res.render('admin/coupons', { title: 'Admin — Coupons', admin: req.admin, section: 'coupons',
      coupons, stores, active: f.active });
  } catch (err) { next(err); }
});

router.get('/coupons/new', async (req, res) => {
  const stores = await db.query('SELECT id, name FROM stores WHERE is_active = 1 ORDER BY name');
  res.render('admin/coupon-form', { title: 'Admin — New Coupon', admin: req.admin, section: 'coupons', coupon: null, stores });
});

router.get('/coupons/:id/edit', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM coupons WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/admin/coupons');
    const stores = await db.query('SELECT id, name FROM stores WHERE is_active = 1 ORDER BY name');
    res.render('admin/coupon-form', { title: 'Admin — Edit Coupon', admin: req.admin, section: 'coupons', coupon: rows[0], stores });
  } catch (err) { next(err); }
});

router.post('/coupons/save', async (req, res, next) => {
  try {
    const b = req.body;
    const vals = [b.store_id, (b.code || '').toUpperCase(), b.title, b.description || '',
      b.discount_text || '', numOrNull(b.min_order) || 0, b.expiry_date || null,
      boolInt(b.is_verified), boolInt(b.is_active)];
    if (b.id) {
      await db.query(`
        UPDATE coupons SET store_id=?, code=?, title=?, description=?, discount_text=?,
          min_order=?, expiry_date=?, is_verified=?, is_active=? WHERE id=?
      `, [...vals, b.id]);
    } else {
      await db.query(`
        INSERT INTO coupons (store_id, code, title, description, discount_text, min_order,
          expiry_date, is_verified, is_active, id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [...vals, uid('cp')]);
    }
    res.redirect('/admin/coupons');
  } catch (err) { next(err); }
});

router.post('/coupons/:id/delete', async (req, res, next) => {
  try {
    await db.query('UPDATE coupons SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.redirect('/admin/coupons');
  } catch (err) { next(err); }
});

// BANNERS
router.get('/banners', async (req, res, next) => {
  try {
    const f = listFilter(req.query, { search: ['title', 'subtitle'], bool: { status: 'is_active' } });
    const banners = await db.query(`SELECT * FROM banners${f.clause} ORDER BY sort_order ASC`, f.params);
    res.render('admin/banners', { title: 'Admin — Banners', admin: req.admin, section: 'banners', banners, active: f.active });
  } catch (err) { next(err); }
});

router.get('/banners/new', (req, res) =>
  res.render('admin/banner-form', { title: 'Admin — New Banner', admin: req.admin, section: 'banners', banner: null }));

router.get('/banners/:id/edit', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM banners WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/admin/banners');
    res.render('admin/banner-form', { title: 'Admin — Edit Banner', admin: req.admin, section: 'banners', banner: rows[0] });
  } catch (err) { next(err); }
});

router.post('/banners/save', async (req, res, next) => {
  try {
    const b = req.body;
    const vals = [b.title, b.subtitle || '', b.image_url || null, b.bg_color || '#4f46e5',
      b.link_url || null, parseInt(b.sort_order, 10) || 0, boolInt(b.is_active)];
    if (b.id) {
      await db.query(`
        UPDATE banners SET title=?, subtitle=?, image_url=?, bg_color=?, link_url=?, sort_order=?, is_active=? WHERE id=?
      `, [...vals, b.id]);
    } else {
      await db.query(`
        INSERT INTO banners (title, subtitle, image_url, bg_color, link_url, sort_order, is_active, id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [...vals, uid('bn')]);
    }
    res.redirect('/admin/banners');
  } catch (err) { next(err); }
});

router.post('/banners/:id/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM banners WHERE id = ?', [req.params.id]);
    res.redirect('/admin/banners');
  } catch (err) { next(err); }
});

// BANK CARDS (apply-for cards)
router.get('/cards', async (req, res, next) => {
  try {
    const f = listFilter(req.query, { search: ['name', 'bank'], eq: { type: 'card_type' }, bool: { status: 'is_active', featured: 'is_featured' } });
    const cards = await db.query(`SELECT * FROM bank_cards${f.clause} ORDER BY is_featured DESC, sort_order ASC, name ASC`, f.params);
    res.render('admin/cards', { title: 'Admin — Bank Cards', admin: req.admin, section: 'cards', cards, active: f.active });
  } catch (err) { next(err); }
});

router.get('/cards/new', (req, res) =>
  res.render('admin/card-form', { title: 'Admin — New Card', admin: req.admin, section: 'cards', card: null }));

router.get('/cards/:id/edit', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM bank_cards WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/admin/cards');
    res.render('admin/card-form', { title: 'Admin — Edit Card', admin: req.admin, section: 'cards', card: rows[0] });
  } catch (err) { next(err); }
});

router.post('/cards/save', async (req, res, next) => {
  try {
    const b = req.body;
    const vals = [b.name, b.bank, b.network || null, b.card_type || 'credit', b.image_url || null,
      b.tagline || null, b.joining_fee || null, b.annual_fee || null, b.best_for || null,
      linesToJson(b.benefits), linesToJson(b.how_to_apply), b.eligibility || null,
      b.apply_url || null, b.video_url || null, boolInt(b.is_featured),
      parseInt(b.sort_order, 10) || 0, boolInt(b.is_active)];
    if (b.id) {
      await db.query(`
        UPDATE bank_cards SET name=?, bank=?, network=?, card_type=?, image_url=?, tagline=?,
          joining_fee=?, annual_fee=?, best_for=?, benefits=?, how_to_apply=?, eligibility=?,
          apply_url=?, video_url=?, is_featured=?, sort_order=?, is_active=? WHERE id=?
      `, [...vals, b.id]);
    } else {
      await db.query(`
        INSERT INTO bank_cards (name, bank, network, card_type, image_url, tagline, joining_fee,
          annual_fee, best_for, benefits, how_to_apply, eligibility, apply_url, video_url,
          is_featured, sort_order, is_active, id, slug)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [...vals, uid('bc'), slugify(b.name) + '-' + Math.random().toString(36).slice(2, 5)]);
    }
    res.redirect('/admin/cards');
  } catch (err) { next(err); }
});

router.post('/cards/:id/delete', async (req, res, next) => {
  try {
    await db.query('UPDATE bank_cards SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.redirect('/admin/cards');
  } catch (err) { next(err); }
});

// BUYING GUIDES + items
router.get('/guides', async (req, res, next) => {
  try {
    const f = listFilter(req.query, { search: ['g.title', 'g.slug'], eq: { category: 'g.category' }, bool: { status: 'g.is_active' } });
    const guides = await db.query(`
      SELECT g.*, (SELECT COUNT(*) FROM guide_items gi WHERE gi.guide_id = g.id) AS item_count
      FROM guides g${f.clause} ORDER BY g.sort_order ASC, g.created_at DESC`, f.params);
    res.render('admin/guides', { title: 'Admin — Buying Guides', admin: req.admin, section: 'guides',
      guides, categories: CATEGORIES, active: f.active });
  } catch (err) { next(err); }
});

router.get('/guides/new', (req, res) =>
  res.render('admin/guide-form', { title: 'Admin — New Guide', admin: req.admin, section: 'guides', guide: null, items: [], categories: CATEGORIES }));

router.get('/guides/:id/edit', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM guides WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/admin/guides');
    const items = await db.query('SELECT * FROM guide_items WHERE guide_id = ? ORDER BY rank_no ASC', [req.params.id]);
    res.render('admin/guide-form', { title: 'Admin — Edit Guide', admin: req.admin, section: 'guides', guide: rows[0], items, categories: CATEGORIES });
  } catch (err) { next(err); }
});

router.post('/guides/save', async (req, res, next) => {
  try {
    const b = req.body;
    const vals = [b.title, b.category || null, b.subtitle || null, b.intro || null,
      b.hero_image || null, b.video_url || null, parseInt(b.sort_order, 10) || 0, boolInt(b.is_active)];
    if (b.id) {
      await db.query(`
        UPDATE guides SET title=?, category=?, subtitle=?, intro=?, hero_image=?, video_url=?,
          sort_order=?, is_active=?, updated_at=? WHERE id=?
      `, [...vals, nowSql(), b.id]);
      res.redirect('/admin/guides/' + b.id + '/edit');
    } else {
      const id = uid('gd');
      await db.query(`
        INSERT INTO guides (title, category, subtitle, intro, hero_image, video_url, sort_order, is_active, id, slug)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [...vals, id, slugify(b.title) + '-' + Math.random().toString(36).slice(2, 5)]);
      res.redirect('/admin/guides/' + id + '/edit');
    }
  } catch (err) { next(err); }
});

router.post('/guides/:id/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM guide_items WHERE guide_id = ?', [req.params.id]);
    await db.query('DELETE FROM guides WHERE id = ?', [req.params.id]);
    res.redirect('/admin/guides');
  } catch (err) { next(err); }
});

router.post('/guides/:gid/items/save', async (req, res, next) => {
  try {
    const b = req.body;
    const vals = [parseInt(b.rank_no, 10) || 0, b.name, b.image_url || null, numOrNull(b.price),
      b.award || null, linesToJson(b.features), linesToJson(b.pros), linesToJson(b.cons),
      b.why_choose || null, b.video_url || null, b.buy_url || null, b.deal_id || null];
    if (b.item_id) {
      await db.query(`
        UPDATE guide_items SET rank_no=?, name=?, image_url=?, price=?, award=?, features=?, pros=?,
          cons=?, why_choose=?, video_url=?, buy_url=?, deal_id=? WHERE id=?
      `, [...vals, b.item_id]);
    } else {
      await db.query(`
        INSERT INTO guide_items (rank_no, name, image_url, price, award, features, pros, cons,
          why_choose, video_url, buy_url, deal_id, id, guide_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [...vals, uid('gi'), req.params.gid]);
    }
    res.redirect('/admin/guides/' + req.params.gid + '/edit');
  } catch (err) { next(err); }
});

router.post('/guides/:gid/items/:itemId/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM guide_items WHERE id = ? AND guide_id = ?', [req.params.itemId, req.params.gid]);
    res.redirect('/admin/guides/' + req.params.gid + '/edit');
  } catch (err) { next(err); }
});

// USERS (subscribers) — read-only list
router.get('/users', async (req, res, next) => {
  try {
    const f = listFilter(req.query, {
      search: ['u.username', 'u.email', 'u.mobile'],
      bool: { whatsapp: 'u.whatsapp_optin', bulk: 'u.is_bulk_buyer' }
    });
    const users = await db.query(`
      SELECT u.*,
        (SELECT COUNT(*) FROM user_cards uc WHERE uc.user_id = u.id) AS card_count,
        (SELECT COUNT(*) FROM user_categories ucat WHERE ucat.user_id = u.id) AS cat_count
      FROM users u${f.clause} ORDER BY u.created_at DESC LIMIT 500`, f.params);
    res.render('admin/users', { title: 'Admin — Users', admin: req.admin, section: 'users', users, active: f.active });
  } catch (err) { next(err); }
});

// ALERTS — queued card-sale notifications
async function renderAlerts(req, res, extra = {}) {
  const alerts = await db.query(`
    SELECT a.*, u.username, u.email, u.mobile, u.whatsapp_optin
    FROM alerts a JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT 500`);
  const pending = alerts.filter(a => !a.is_sent).length;
  res.render('admin/alerts', Object.assign(
    { title: 'Admin — Alerts', admin: req.admin, section: 'alerts', alerts, pending,
      mailer: mailerMode(), result: null, error: null }, extra));
}

router.get('/alerts', async (req, res, next) => {
  try { await renderAlerts(req, res); } catch (err) { next(err); }
});

// Actually deliver: emails every active user their pending alerts, marks them sent.
router.post('/alerts/send', async (req, res, next) => {
  try {
    const result = await deliverPendingAlerts();
    await renderAlerts(req, res, { result });
  } catch (err) { next(err); }
});

// Check the SMTP connection (or confirm log mode) without sending anything.
router.post('/alerts/test', async (req, res, next) => {
  try {
    const t = await verifyTransport();
    await renderAlerts(req, res, t.ok
      ? { result: { mode: t.mode, users: 0, attempted: 0, sent: 0, failed: 0, skipped: 0, errors: [], test: t.note || 'Connection OK' } }
      : { error: `SMTP test failed: ${t.error}` });
  } catch (err) { next(err); }
});

// Manual override: flag everything sent without emailing (e.g. already handled elsewhere).
router.post('/alerts/mark-sent', async (req, res, next) => {
  try {
    await db.query('UPDATE alerts SET is_sent = 1, sent_at = ? WHERE is_sent = 0', [nowSql()]);
    await renderAlerts(req, res, { result: { markedOnly: true } });
  } catch (err) { next(err); }
});

module.exports = router;
