'use strict';

/**
 * User accounts — registration, login and the account dashboard.
 * A user picks the product categories they care about and the bank cards they
 * hold; when an admin publishes an offer on one of those cards, the alert engine
 * (services/alerts.js) queues a notification that shows up here.
 */

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { sendMail } = require('../services/mailer');
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

// ── Email verification (OTP + one-click link) ─────────────────────────────────
// New accounts start with email_verified = 0 and can't log in until the address
// is proven: we email a 6-digit code plus a magic link, both valid 15 minutes.
const OTP_TTL = 15 * 60000;
const maskEmail = e => {
  const [u, d] = String(e).split('@');
  return (u.length <= 2 ? u[0] + '*' : u[0] + '***' + u[u.length - 1]) + '@' + d;
};

async function issueOtp(user) {
  const otp = String(crypto.randomInt(100000, 1000000));
  const token = crypto.randomBytes(24).toString('hex');
  await db.query('UPDATE users SET otp_code = ?, verify_token = ?, otp_expires = ? WHERE id = ?',
    [otp, token, String(Date.now() + OTP_TTL), user.id]);
  const link = `${config.siteUrl}/verify-email?u=${user.id}&t=${token}`;
  await sendMail({
    to: user.email,
    subject: `${otp} is your IndiaOffers verification code`,
    text: `Hi ${user.username},\n\nYour IndiaOffers verification code is: ${otp}\n\nOr verify with one click:\n${link}\n\nThe code expires in 15 minutes. If you didn't create an IndiaOffers account, just ignore this email.`,
    html: `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:8px">
        <h2 style="color:#0c2b55;margin:0 0 4px">Verify your email</h2>
        <p style="color:#475569;margin:0 0 18px">Hi <b>${user.username}</b>, welcome to IndiaOffers.in! Enter this code on the verification page:</p>
        <div style="font-size:34px;font-weight:800;letter-spacing:10px;text-align:center;background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:12px;padding:18px 10px;color:#0c2b55">${otp}</div>
        <p style="text-align:center;margin:18px 0"><a href="${link}" style="background:#2f6df6;color:#fff;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:50px;display:inline-block">✓ Or verify with one click</a></p>
        <p style="color:#94a3b8;font-size:12.5px">The code and link expire in 15 minutes. Didn't sign up? Just ignore this email.</p>
      </div>`
  });
}

async function completeVerification(res, user) {
  await db.query('UPDATE users SET email_verified = 1, otp_code = NULL, verify_token = NULL, otp_expires = NULL, last_login = ? WHERE id = ?',
    [nowSql(), user.id]);
  res.cookie('io_user', signUser(user), sessionCookie(30 * 864e5));
  res.redirect('/account?welcome=1');
}

const verifyView = (user, extra) => Object.assign({
  title: 'Verify your email — IndiaOffers.in', meta: {},
  uid: user.id, maskedEmail: maskEmail(user.email), error: null, sent: false
}, extra);

router.get('/verify-email', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM users WHERE id = ?', [String(req.query.u || '')]);
    if (!rows.length) return res.redirect('/register');
    const user = rows[0];
    if (user.email_verified) return res.redirect(req.user ? '/account' : '/login');
    // Magic-link click: token in the URL verifies without typing the code.
    if (req.query.t && user.verify_token && req.query.t === user.verify_token && Number(user.otp_expires) > Date.now()) {
      return completeVerification(res, user);
    }
    res.render('account/verify', verifyView(user, { sent: req.query.sent === '1' }));
  } catch (err) { next(err); }
});

router.post('/verify-email', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM users WHERE id = ?', [String(req.body.u || '')]);
    if (!rows.length) return res.redirect('/register');
    const user = rows[0];
    if (user.email_verified) return res.redirect('/login');
    const otp = String(req.body.otp || '').replace(/\D/g, '');
    if (!user.otp_code || Number(user.otp_expires) < Date.now()) {
      return res.status(400).render('account/verify', verifyView(user, { error: 'That code has expired — tap "Resend code" for a fresh one.' }));
    }
    if (otp !== String(user.otp_code)) {
      return res.status(400).render('account/verify', verifyView(user, { error: 'That code doesn\'t match — check the 6 digits and try again.' }));
    }
    return completeVerification(res, user);
  } catch (err) { next(err); }
});

router.post('/verify-email/resend', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM users WHERE id = ?', [String(req.body.u || '')]);
    if (!rows.length) return res.redirect('/register');
    const user = rows[0];
    if (user.email_verified) return res.redirect('/login');
    // Throttle: if the current code was issued under a minute ago, don't resend.
    if (user.otp_expires && Number(user.otp_expires) - Date.now() > OTP_TTL - 60000) {
      return res.render('account/verify', verifyView(user, { error: 'We just sent a code — give it a minute to arrive (check spam too).' }));
    }
    await issueOtp(user);
    res.render('account/verify', verifyView(user, { sent: true }));
  } catch (err) { next(err); }
});

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

    // Honeypot: hidden "company" field — humans never see it, bots fill it.
    if (String(b.company || '').trim() !== '') return res.redirect('/');

    const id = uid('usr');
    const hash = bcrypt.hashSync(b.password, 10);
    await db.query(
      `INSERT INTO users (id, username, email, mobile, password_hash, whatsapp_optin, is_bulk_buyer, email_verified, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`,
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

    // No login yet — prove the email first (OTP + magic link just sent).
    await issueOtp({ id, username, email });
    res.redirect(`/verify-email?u=${id}&sent=1`);
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
    // Unverified account: send a fresh code and route to the verify page.
    if (!rows[0].email_verified) {
      await issueOtp(rows[0]);
      return res.redirect(`/verify-email?u=${rows[0].id}&sent=1`);
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
    const [rows, myCats, myCards, banks, alerts, subs] = await Promise.all([
      db.query('SELECT * FROM users WHERE id = ?', [req.user.id]),
      db.query('SELECT category FROM user_categories WHERE user_id = ?', [req.user.id]),
      db.query(`SELECT bc.* FROM user_cards uc JOIN bank_cards bc ON bc.id = uc.bank_card_id WHERE uc.user_id = ?`, [req.user.id]),
      activeBanks(),
      db.query('SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [req.user.id]),
      db.query('SELECT COUNT(*) AS n FROM user_deals WHERE user_id = ?', [req.user.id])
    ]);
    if (rows.length === 0) { res.clearCookie('io_user', clearOpts()); return res.redirect('/login'); }

    res.render('account/dashboard', {
      title: 'My Account — IndiaOffers.in', meta: {},
      account: rows[0],
      myCats: myCats.map(c => c.category),
      myBanks: [...new Set(myCards.map(c => c.bank))],
      banks, alerts,
      submissionCount: Number(subs[0].n) || 0,
      categoryGroups: CATEGORY_GROUPS,
      saved: req.query.saved === '1',
      welcome: req.query.welcome === '1'
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

// ── Submit a deal (partner programme) ─────────────────────────────────────────
// Registered users submit deals they find; admin reviews them in /admin/submissions
// and awards points on approval. Points show here and on the account dashboard.
async function submitDealData(userId) {
  const [urows, submissions] = await Promise.all([
    db.query('SELECT points FROM users WHERE id = ?', [userId]),
    db.query('SELECT * FROM user_deals WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', [userId])
  ]);
  return { points: urows[0] ? (urows[0].points || 0) : 0, submissions };
}

const submitDealView = extra => Object.assign({
  title: 'Submit a Deal — Earn Rewards — IndiaOffers.in',
  meta: { description: 'Submit deals you find and earn points redeemable for free gifts, vouchers and real money when they are approved.' },
  sent: false, error: null, form: {}
}, extra);

router.get('/submit-deal', userAuth, async (req, res, next) => {
  try {
    res.render('submit-deal', submitDealView(await submitDealData(req.user.id)));
  } catch (err) { next(err); }
});

router.post('/submit-deal', userAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const title = String(b.title || '').trim().slice(0, 300);
    const dealUrl = String(b.deal_url || '').trim().slice(0, 1000);
    const numOrNull = v => (v === undefined || v === null || v === '') ? null : parseFloat(v);
    const rerender = async error => res.status(400).render('submit-deal',
      submitDealView({ error, form: b, ...(await submitDealData(req.user.id)) }));

    if (!title) return rerender('Please give the deal a title.');
    if (!/^https?:\/\/\S+\.\S+/.test(dealUrl)) return rerender('Please paste a valid deal link (starting with http/https).');
    const recent = await db.query(
      "SELECT COUNT(*) AS n FROM user_deals WHERE user_id = ? AND status = 'pending'", [req.user.id]);
    if (Number(recent[0].n) >= 20) return rerender('You have 20 deals pending review — hang tight while we catch up!');

    await db.query(`
      INSERT INTO user_deals (id, user_id, title, deal_url, price, mrp, store_name, coupon_code, note, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [db.uid('ud'), req.user.id, title, dealUrl, numOrNull(b.price), numOrNull(b.mrp),
        String(b.store_name || '').trim().slice(0, 120) || null,
        String(b.coupon_code || '').trim().slice(0, 80) || null,
        String(b.note || '').trim().slice(0, 2000) || null]);

    res.render('submit-deal', submitDealView({ sent: true, ...(await submitDealData(req.user.id)) }));
  } catch (err) { next(err); }
});

module.exports = router;
