'use strict';

/**
 * Admin panel — server-rendered, form-POST based (no client framework).
 * Login sets an httpOnly JWT cookie; everything under /admin requires it.
 */

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { adminAuth, signAdmin } = require('../middleware/auth');
const { savingsStack, activeBankOffers } = require('../services/savings');

const { uid, slugify, nowSql } = db;

// ── Auth ──────────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => res.render('admin/login', { title: 'Admin Login', error: null }));

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const rows = await db.query('SELECT * FROM admins WHERE email = ?', [email || '']);
  if (rows.length === 0 || !(await bcrypt.compare(password || '', rows[0].password_hash))) {
    return res.status(401).render('admin/login', { title: 'Admin Login', error: 'Invalid credentials' });
  }
  await db.query('UPDATE admins SET last_login = ? WHERE id = ?', [nowSql(), rows[0].id]);
  res.cookie('io_admin', signAdmin(rows[0]), { httpOnly: true, sameSite: 'lax', maxAge: 7 * 864e5 });
  res.redirect('/admin');
});

router.post('/logout', (req, res) => { res.clearCookie('io_admin'); res.redirect('/admin/login'); });

router.use(adminAuth);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const [deals, offers, coupons, banners, clicks, topDeals] = await Promise.all([
      db.query('SELECT COUNT(*) AS c FROM deals WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS c FROM bank_offers WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS c FROM coupons WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS c FROM banners WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS c FROM clicks'),
      db.query('SELECT id, title, clicks FROM deals ORDER BY clicks DESC LIMIT 8')
    ]);
    res.render('admin/dashboard', {
      title: 'Admin — Dashboard', admin: req.admin, section: 'dashboard',
      stats: { deals: deals[0].c, offers: offers[0].c, coupons: coupons[0].c, banners: banners[0].c, clicks: clicks[0].c },
      topDeals
    });
  } catch (err) { next(err); }
});

// ── Generic list/save/delete helpers per entity ──────────────────────────────
const boolInt = v => (v === 'on' || v === '1' || v === 1 || v === true) ? 1 : 0;
const numOrNull = v => (v === undefined || v === null || v === '') ? null : parseFloat(v);

// DEALS
router.get('/deals', async (req, res, next) => {
  try {
    const deals = await db.query(`
      SELECT d.*, s.name AS store_name FROM deals d LEFT JOIN stores s ON s.id = d.store_id
      ORDER BY d.posted_at DESC LIMIT 200`);
    res.render('admin/deals', { title: 'Admin — Deals', admin: req.admin, section: 'deals', deals });
  } catch (err) { next(err); }
});

router.get('/deals/new', async (req, res, next) => {
  try {
    const stores = await db.query('SELECT id, name FROM stores WHERE is_active = 1 ORDER BY name');
    res.render('admin/deal-form', { title: 'Admin — New Deal', admin: req.admin, section: 'deals', deal: null, stores });
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
      deal: rows[0], stores, stack: savingsStack(rows[0], offers)
    });
  } catch (err) { next(err); }
});

router.post('/deals/save', async (req, res, next) => {
  try {
    const b = req.body;
    const howTo = JSON.stringify(String(b.how_to || '').split('\n').map(s => s.trim()).filter(Boolean));
    if (b.id) {
      await db.query(`
        UPDATE deals SET store_id=?, title=?, description=?, category=?, image_url=?, mrp=?, price=?,
          coupon_code=?, deal_url=?, how_to=?, badge=?, cashback_text=?, is_trending=?, is_active=?,
          expiry_date=?, updated_at=?
        WHERE id=?
      `, [b.store_id, b.title, b.description || '', b.category || '', b.image_url || null,
          numOrNull(b.mrp), numOrNull(b.price), b.coupon_code || null, b.deal_url || null, howTo,
          b.badge || null, b.cashback_text || null, boolInt(b.is_trending), boolInt(b.is_active),
          b.expiry_date || null, nowSql(), b.id]);
    } else {
      await db.query(`
        INSERT INTO deals (id, slug, store_id, title, description, category, image_url, mrp, price,
          coupon_code, deal_url, how_to, badge, cashback_text, is_trending, is_active, expiry_date, posted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [uid('dl'), slugify(b.title) + '-' + Math.random().toString(36).slice(2, 5), b.store_id, b.title,
          b.description || '', b.category || '', b.image_url || null, numOrNull(b.mrp), numOrNull(b.price),
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
    const offers = await db.query(`
      SELECT o.*, s.name AS store_name FROM bank_offers o LEFT JOIN stores s ON s.id = o.store_id
      ORDER BY o.created_at DESC`);
    res.render('admin/bank-offers', { title: 'Admin — Bank Offers', admin: req.admin, section: 'bank-offers', offers });
  } catch (err) { next(err); }
});

router.get('/bank-offers/new', async (req, res, next) => {
  const stores = await db.query('SELECT id, name FROM stores WHERE is_active = 1 ORDER BY name');
  res.render('admin/bank-offer-form', { title: 'Admin — New Bank Offer', admin: req.admin, section: 'bank-offers', offer: null, stores });
});

router.get('/bank-offers/:id/edit', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM bank_offers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/admin/bank-offers');
    const stores = await db.query('SELECT id, name FROM stores WHERE is_active = 1 ORDER BY name');
    res.render('admin/bank-offer-form', { title: 'Admin — Edit Bank Offer', admin: req.admin, section: 'bank-offers', offer: rows[0], stores });
  } catch (err) { next(err); }
});

router.post('/bank-offers/save', async (req, res, next) => {
  try {
    const b = req.body;
    const vals = [b.bank, b.instrument || 'credit', b.title, b.description || '',
      b.discount_type || 'percent', numOrNull(b.discount_value) || 0, numOrNull(b.max_discount),
      numOrNull(b.min_order) || 0, b.store_id || null, b.promo_code || null,
      b.valid_from || null, b.valid_till || null, b.source_url || null, boolInt(b.is_active)];
    if (b.id) {
      await db.query(`
        UPDATE bank_offers SET bank=?, instrument=?, title=?, description=?, discount_type=?,
          discount_value=?, max_discount=?, min_order=?, store_id=?, promo_code=?,
          valid_from=?, valid_till=?, source_url=?, is_active=? WHERE id=?
      `, [...vals, b.id]);
    } else {
      await db.query(`
        INSERT INTO bank_offers (bank, instrument, title, description, discount_type, discount_value,
          max_discount, min_order, store_id, promo_code, valid_from, valid_till, source_url, is_active, id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [...vals, uid('bo')]);
    }
    res.redirect('/admin/bank-offers');
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
    const stores = await db.query(`
      SELECT s.*, (SELECT COUNT(*) FROM deals d WHERE d.store_id = s.id AND d.is_active = 1) AS deal_count
      FROM stores s ORDER BY s.name`);
    res.render('admin/stores', { title: 'Admin — Stores', admin: req.admin, section: 'stores', stores });
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
    const vals = [b.name, b.color || '#4f46e5', b.logo_url || null, b.category || '', b.description || '',
      b.website_url || null, b.affiliate_url || b.website_url || null, b.affiliate_type || 'none',
      b.cashback_text || null, boolInt(b.is_active)];
    if (b.id) {
      await db.query(`
        UPDATE stores SET name=?, color=?, logo_url=?, category=?, description=?, website_url=?,
          affiliate_url=?, affiliate_type=?, cashback_text=?, is_active=? WHERE id=?
      `, [...vals, b.id]);
    } else {
      await db.query(`
        INSERT INTO stores (name, color, logo_url, category, description, website_url,
          affiliate_url, affiliate_type, cashback_text, is_active, id, slug)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    const coupons = await db.query(`
      SELECT c.*, s.name AS store_name FROM coupons c LEFT JOIN stores s ON s.id = c.store_id
      ORDER BY c.created_at DESC`);
    res.render('admin/coupons', { title: 'Admin — Coupons', admin: req.admin, section: 'coupons', coupons });
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
    const banners = await db.query('SELECT * FROM banners ORDER BY sort_order ASC');
    res.render('admin/banners', { title: 'Admin — Banners', admin: req.admin, section: 'banners', banners });
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

module.exports = router;
