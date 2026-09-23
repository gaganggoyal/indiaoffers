'use strict';

/** Small public JSON API (search suggestions, savings calculator). */

const crypto = require('crypto');
const router = require('express').Router();
const db = require('../db');
const { savingsStack, activeBankOffers, decorateDeals } = require('../services/savings');

router.get('/suggest', async (req, res) => {
  const q = (req.query.q || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (q.length < 2) return res.json({ stores: [], deals: [], cards: [], guides: [] });
  try {
    // Tokenized like the /search page: every word must match.
    const tokens = q.split(' ').slice(0, 6);
    const and = expr => tokens.map(() => expr).join(' AND ');
    const lp = n => tokens.flatMap(t => Array(n).fill(`%${t}%`));

    const [stores, deals, cards, guides] = await Promise.all([
      db.query(`SELECT slug, name, color, logo_url, website_url FROM stores
                WHERE is_active = 1 AND ${and('(name LIKE ? OR slug LIKE ?)')} ORDER BY name ASC LIMIT 4`, lp(2)),
      db.query(`SELECT slug, title, price FROM deals
                WHERE is_active = 1 AND ${and('(title LIKE ? OR description LIKE ?)')}
                ORDER BY CASE WHEN ${and('title LIKE ?')} THEN 0 ELSE 1 END, clicks DESC, posted_at DESC LIMIT 6`,
                [...lp(2), ...lp(1)]),
      db.query(`SELECT slug, name, bank FROM bank_cards
                WHERE is_active = 1 AND ${and('(name LIKE ? OR bank LIKE ?)')}
                ORDER BY is_featured DESC, sort_order ASC LIMIT 3`, lp(2)),
      db.query(`SELECT slug, title FROM guides
                WHERE is_active = 1 AND ${and('(title LIKE ? OR subtitle LIKE ?)')}
                ORDER BY updated_at DESC LIMIT 3`, lp(2))
    ]);

    res.json({
      stores: stores.map(s => {
        const domain = ((s.website_url || '').match(/^https?:\/\/([^\/]+)/) || [])[1];
        const icon = s.logo_url || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null);
        return { slug: s.slug, name: s.name, color: s.color, icon };
      }),
      deals: deals.map(d => ({ slug: d.slug, title: d.title, price: d.price })),
      cards: cards.map(c => ({ slug: c.slug, name: c.name, bank: c.bank })),
      guides: guides.map(g => ({ slug: g.slug, title: g.title }))
    });
  } catch {
    res.json({ stores: [], deals: [], cards: [], guides: [] });
  }
});

/** Savings stack for one deal (used by admin preview). */
router.get('/savings/:dealId', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM deals WHERE id = ?', [req.params.dealId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const offers = await activeBankOffers();
    res.json({ stack: savingsStack(rows[0], offers) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1 AS ok');
    res.json({ status: 'ok', driver: db.driver });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

/* ---------------------------------------------------------------------------
 * Deals feed for the AmaFast browser extension.
 *
 * The feed never exposes a merchant URL — extensions receive the /go/ path and
 * nothing else. The affiliate tag is therefore only ever attached here, by the
 * redirect, on a click the user made against our own deal listing. There is no
 * merchant URL in the payload for a client to tag, re-tag, or rewrite.
 * ------------------------------------------------------------------------ */

const EXT_MAX = 100;

/* AmaFast is distributed from our own site, not the Chrome Web Store, so it has
   no auto-update channel. The extension polls this feed anyway, so the feed is
   also how an installed copy learns a newer build exists. Release details live
   in data/extension.js, which the /amafast download page reads too. */
const RELEASE = require('../data/extension');
const EXT_LATEST = { version: RELEASE.version, url: RELEASE.url, notes: RELEASE.notes };

function asinOf(url) {
  const u = String(url || '');
  if (!/(^|\.)amazon\.[a-z.]+/i.test(u)) return null;
  // /dp/B0…, /gp/product/B0…, /gp/aw/d/B0…, and the slug and /-/en/ variants,
  // which all still carry the marker segment; plus the ?asin= query form.
  const m = u.match(/\/(?:dp|gp\/product|gp\/aw\/d|dp\/product|product)\/([A-Z0-9]{10})(?![A-Z0-9])/i)
         || u.match(/[?&]asin=([A-Z0-9]{10})(?![A-Z0-9])/i);
  return m ? m[1].toUpperCase() : null;
}

router.get('/extension/deals.json', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'public, max-age=300');
  try {
    const badge = String(req.query.badge || '').trim().toUpperCase().slice(0, 20);
    const params = [];
    let where = 'WHERE d.is_active = 1';
    if (badge) { where += ' AND UPPER(d.badge) = ?'; params.push(badge); }

    const rows = await db.query(`
      SELECT d.*, s.slug AS store_slug, s.name AS store_name
      FROM deals d JOIN stores s ON s.id = d.store_id
      ${where}
      ORDER BY COALESCE(d.hotness, 0) DESC, d.posted_at DESC
      LIMIT ${EXT_MAX}
    `, params);

    const deals = decorateDeals(rows).map(d => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      store: d.store_slug,
      storeName: d.store_name,
      asin: asinOf(d.deal_url),
      image: d.image_url || null,
      price: d.price != null ? +d.price : null,
      mrp: d.mrp != null ? +d.mrp : null,
      discountPct: d.stack.discountPct,
      truePrice: d.stack.truePrice,
      bestOffer: d.stack.best ? d.stack.best.label : null,
      bestSaving: d.stack.best ? d.stack.best.saving : null,
      coupon: d.coupon_code || null,
      badge: d.badge || null,
      category: d.category || null,
      postedAt: d.posted_at,
      go: `/go/d/${d.id}`,
      deal: `/deal/${d.slug}`
    }));

    // Derived from the data, not the clock, so the body is byte-stable between
    // deal edits and the ETag can actually serve 304s.
    const updated = rows.map(r => r.updated_at || r.posted_at).filter(Boolean).sort().pop() || null;
    const body = JSON.stringify({ updated, extension: EXT_LATEST, count: deals.length, deals });
    const etag = '"' + crypto.createHash('sha1').update(body).digest('base64').slice(0, 27) + '"';
    res.set('ETag', etag);
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.type('application/json').send(body);
  } catch (err) {
    console.error('[API] extension feed failed:', err.message);
    res.status(500).json({ error: 'Feed unavailable' });
  }
});

module.exports = router;
