'use strict';

/**
 * User accounts — registration, login and the account dashboard.
 * A user picks the product categories they care about and the bank cards they
 * hold; when an admin publishes an offer on one of those cards, the alert engine
 * (services/alerts.js) queues a notification that shows up here.
 */

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { userAuth, signUser, sessionCookie, clearOpts } = require('../middleware/auth');
const { CATEGORIES, CATEGORY_GROUPS } = require('../data/taxonomy');

const { uid, nowSql } = db;
const boolInt = v => (v === 'on' || v === '1' || v === 1 || v === true) ? 1 : 0;
const asArray = v => v == null ? [] : (Array.isArray(v) ? v : [v]);

// Users pick cards by *bank name* only (short & simple). We resolve a bank to all
// of its active card ids so the existing card-targeted alert engine still fires.
async function activeBanks() {
  const rows = await db.query('SELECT DISTINCT bank FROM bank_cards WHERE is_active = 1 ORDER BY bank');
  return rows.map(r => r.bank);
}
async function cardIdsForBanks(banks) {
  const list = [...new Set(asArray(banks).filter(Boolean))];
  if (!list.length) return [];
  const rows = await db.query(
    `SELECT id FROM bank_cards WHERE is_active = 1 AND bank IN (${list.map(() => '?').join(',')})`, list);
  return rows.map(r => r.id);
}

// ── Register ──────────────────────────────────────────────────────────────────
router.get('/register', async (req, res, next) => {
  try {
    if (req.user) return res.redirect('/account');
    res.render('account/register', {
      title: 'Create your IndiaOffers account — Deal & card-sale alerts',
      meta: { description: 'Sign up to get alerts when there is a sale on your bank card and deals in the categories you care about.' },
      banks: await activeBanks(), categoryGroups: CATEGORY_GROUPS,
      form: {}, error: null
    });
  } catch (err) { next(err); }
});

router.post('/register', async (req, res, next) => {
  try {
    const b = req.body;
    const username = String(b.username || '').trim().toLowerCase();
    const email = String(b.email || '').trim().toLowerCase();
    const mobile = String(b.mobile || '').trim();
    const banks = await activeBanks();

    const rerender = error => res.status(400).render('account/register', {
      title: 'Create your IndiaOffers account', meta: {},
      banks, categoryGroups: CATEGORY_GROUPS, form: b, error
    });

    if (!/^[a-z0-9_.]{3,30}$/.test(username)) return rerender('Username must be 3-30 letters, numbers, _ or .');
    if (!/^\S+@\S+\.\S+$/.test(email)) return rerender('Please enter a valid email address.');
    if (mobile && !/^[0-9+\-\s]{7,15}$/.test(mobile)) return rerender('Please enter a valid mobile number.');
    if (String(b.password || '').length < 6) return rerender('Password must be at least 6 characters.');

    const clash = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (clash.length) return rerender('That username or email is already registered.');

    const id = uid('usr');
    const hash = bcrypt.hashSync(b.password, 10);
    await db.query(
      `INSERT INTO users (id, username, email, mobile, password_hash, whatsapp_optin, is_bulk_buyer, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, username, email, mobile || null, hash, boolInt(b.whatsapp_optin), boolInt(b.is_bulk_buyer)]
    );

    const catSlugs = CATEGORIES.map(c => c.slug);
    for (const cat of asArray(b.categories).filter(c => catSlugs.includes(c))) {
      await db.query('INSERT IGNORE INTO user_categories (user_id, category) VALUES (?, ?)', [id, cat]);
    }
    const selBanks = asArray(b.banks).filter(x => banks.includes(x));
    for (const cid of await cardIdsForBanks(selBanks)) {
      await db.query('INSERT IGNORE INTO user_cards (user_id, bank_card_id) VALUES (?, ?)', [id, cid]);
    }

    res.cookie('io_user', signUser({ id, username, email }), sessionCookie(30 * 864e5));
    res.redirect('/account');
  } catch (err) { next(err); }
});

// ── Login / logout ────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/account');
  res.render('account/login', {
    title: 'Login — IndiaOffers.in', meta: {},
    next: req.query.next || '/account', error: null
  });
});

router.post('/login', async (req, res, next) => {
  try {
    const id = String(req.body.identifier || '').trim().toLowerCase();
    const rows = await db.query('SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1', [id, id]);
    if (rows.length === 0 || !bcrypt.compareSync(req.body.password || '', rows[0].password_hash)) {
      return res.status(401).render('account/login', {
        title: 'Login — IndiaOffers.in', meta: {},
        next: req.body.next || '/account', error: 'Invalid username/email or password.'
      });
    }
    await db.query('UPDATE users SET last_login = ? WHERE id = ?', [nowSql(), rows[0].id]);
    res.cookie('io_user', signUser(rows[0]), sessionCookie(30 * 864e5));
    const dest = req.body.next && req.body.next.startsWith('/') ? req.body.next : '/account';
    res.redirect(dest);
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => { res.clearCookie('io_user', clearOpts()); res.redirect('/'); });

// ── Account dashboard (requires login) ────────────────────────────────────────
router.get('/account', userAuth, async (req, res, next) => {
  try {
    const [rows, myCats, myCards, banks, alerts] = await Promise.all([
      db.query('SELECT * FROM users WHERE id = ?', [req.user.id]),
      db.query('SELECT category FROM user_categories WHERE user_id = ?', [req.user.id]),
      db.query(`SELECT bc.* FROM user_cards uc JOIN bank_cards bc ON bc.id = uc.bank_card_id WHERE uc.user_id = ?`, [req.user.id]),
      activeBanks(),
      db.query('SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [req.user.id])
    ]);
    if (rows.length === 0) { res.clearCookie('io_user', clearOpts()); return res.redirect('/login'); }

    res.render('account/dashboard', {
      title: 'My Account — IndiaOffers.in', meta: {},
      account: rows[0],
      myCats: myCats.map(c => c.category),
      myBanks: [...new Set(myCards.map(c => c.bank))],
      banks, alerts,
      categoryGroups: CATEGORY_GROUPS,
      saved: req.query.saved === '1'
    });
  } catch (err) { next(err); }
});

router.post('/account/preferences', userAuth, async (req, res, next) => {
  try {
    const b = req.body;
    const id = req.user.id;
    await db.query('UPDATE users SET mobile = ?, whatsapp_optin = ?, is_bulk_buyer = ? WHERE id = ?',
      [String(b.mobile || '').trim() || null, boolInt(b.whatsapp_optin), boolInt(b.is_bulk_buyer), id]);

    const catSlugs = CATEGORIES.map(c => c.slug);
    await db.query('DELETE FROM user_categories WHERE user_id = ?', [id]);
    for (const cat of asArray(b.categories).filter(c => catSlugs.includes(c))) {
      await db.query('INSERT IGNORE INTO user_categories (user_id, category) VALUES (?, ?)', [id, cat]);
    }

    const banks = await activeBanks();
    const selBanks = asArray(b.banks).filter(x => banks.includes(x));
    await db.query('DELETE FROM user_cards WHERE user_id = ?', [id]);
    for (const cid of await cardIdsForBanks(selBanks)) {
      await db.query('INSERT IGNORE INTO user_cards (user_id, bank_card_id) VALUES (?, ?)', [id, cid]);
    }

    res.redirect('/account?saved=1');
  } catch (err) { next(err); }
});

router.post('/account/alerts/read', userAuth, async (req, res, next) => {
  try {
    await db.query('UPDATE alerts SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.redirect('/account');
  } catch (err) { next(err); }
});

module.exports = router;
