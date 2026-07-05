'use strict';

/** Public server-rendered pages. */

const router = require('express').Router();
const db = require('../db');
const config = require('../config');
const { savingsStack, activeBankOffers, decorateDeals } = require('../services/savings');

const CATEGORIES = ['electronics', 'fashion', 'food', 'beauty', 'grocery', 'travel', 'shopping'];
const CAT_ICONS = { electronics: '📱', fashion: '👗', food: '🍔', beauty: '💄', grocery: '🥦', travel: '✈️', shopping: '🛍️' };

async function storesById() {
  const rows = await db.query('SELECT * FROM stores WHERE is_active = 1');
  return Object.fromEntries(rows.map(s => [s.id, s]));
}

// ── Home ──────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const [banners, dealsRaw, offers, storeMap] = await Promise.all([
      db.query('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 6'),
      db.query(`SELECT * FROM deals WHERE is_active = 1 ORDER BY is_trending DESC, posted_at DESC LIMIT 12`),
      activeBankOffers(),
      storesById()
    ]);
    const deals = decorateDeals(dealsRaw, offers);
    const topOffers = offers
      .slice()
      .sort((a, b) => (b.max_discount || b.discount_value * 40) - (a.max_discount || a.discount_value * 40))
      .slice(0, 6);

    res.render('home', {
      title: "IndiaOffers.in — India's True-Price Deals: product discounts + card offers + coupons, stacked",
      meta: {
        description: 'Every deal on IndiaOffers shows the real price after stacking the product discount, your bank card offer and coupon codes. Stop overpaying — see the true price.'
      },
      banners, deals, topOffers, storeMap,
      categories: CATEGORIES, catIcons: CAT_ICONS
    });
  } catch (err) { next(err); }
});

// ── Deals listing ─────────────────────────────────────────────────────────────
router.get('/deals', async (req, res, next) => {
  try {
    const { category, store, sort, q } = req.query;
    let where = 'WHERE d.is_active = 1';
    const params = [];
    if (category && CATEGORIES.includes(category)) { where += ' AND d.category = ?'; params.push(category); }
    if (store) { where += ' AND d.store_id = ?'; params.push(store); }
    if (q) { where += ' AND (d.title LIKE ? OR d.description LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    const order = sort === 'price' ? 'd.price ASC'
                : sort === 'discount' ? '(d.mrp - d.price) DESC'
                : sort === 'popular' ? 'd.clicks DESC'
                : 'd.is_trending DESC, d.posted_at DESC';

    const [rows, offers, storeMap] = await Promise.all([
      db.query(`SELECT d.* FROM deals d ${where} ORDER BY ${order} LIMIT 60`, params),
      activeBankOffers(),
      storesById()
    ]);

    res.render('deals', {
      title: q ? `Deals matching “${q}” — IndiaOffers.in`
             : category ? `Best ${category.charAt(0).toUpperCase() + category.slice(1)} Deals Today — IndiaOffers.in`
             : 'Today\'s Best Deals in India — True Prices — IndiaOffers.in',
      meta: { description: 'Live deals with the full savings stack: product discount + bank offer + coupon.' },
      deals: decorateDeals(rows, offers), storeMap,
      categories: CATEGORIES, catIcons: CAT_ICONS,
      active: { category: category || '', store: store || '', sort: sort || 'latest', q: q || '' }
    });
  } catch (err) { next(err); }
});

// ── Deal detail ───────────────────────────────────────────────────────────────
router.get('/deal/:slug', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM deals WHERE slug = ? AND is_active = 1', [req.params.slug]);
    if (rows.length === 0) return res.status(404).render('404', { title: 'Deal not found', meta: {} });
    const deal = rows[0];

    const [stores, offers, related, coupons] = await Promise.all([
      db.query('SELECT * FROM stores WHERE id = ?', [deal.store_id]),
      activeBankOffers(),
      db.query('SELECT * FROM deals WHERE store_id = ? AND id != ? AND is_active = 1 ORDER BY posted_at DESC LIMIT 4', [deal.store_id, deal.id]),
      db.query('SELECT * FROM coupons WHERE store_id = ? AND is_active = 1 LIMIT 4', [deal.store_id])
    ]);
    const store = stores[0];
    const stack = savingsStack(deal, offers);
    let howTo = [];
    try { howTo = JSON.parse(deal.how_to || '[]'); } catch { howTo = []; }

    // JSON-LD Offer schema
    const jsonld = {
      '@context': 'https://schema.org', '@type': 'Product',
      name: deal.title, image: deal.image_url, description: deal.description,
      offers: {
        '@type': 'Offer', priceCurrency: 'INR', price: deal.price,
        availability: 'https://schema.org/InStock',
        url: `${config.siteUrl}/deal/${deal.slug}`,
        seller: { '@type': 'Organization', name: store ? store.name : '' }
      }
    };

    res.render('deal', {
      title: `${deal.title} — ${stack.truePrice != null ? '₹' + stack.truePrice.toLocaleString('en-IN') + ' true price' : 'Deal'} | IndiaOffers.in`,
      meta: {
        description: `${deal.title}: deal price ${stack.price != null ? '₹' + stack.price.toLocaleString('en-IN') : ''}${stack.best ? `, drops to ₹${stack.truePrice.toLocaleString('en-IN')} with ${stack.best.bank} ${stack.best.instrumentLabel}` : ''}. Full savings stack on IndiaOffers.`,
        image: deal.image_url,
        jsonld
      },
      deal, store, stack, howTo,
      related: decorateDeals(related, offers),
      coupons,
      storeMap: { [deal.store_id]: store }
    });
  } catch (err) { next(err); }
});

// ── Bank offers hub ───────────────────────────────────────────────────────────
router.get('/bank-offers', async (req, res, next) => {
  try {
    const { bank } = req.query;
    const [offers, storeMap] = await Promise.all([activeBankOffers(), storesById()]);
    const banks = [...new Set(offers.map(o => o.bank))].sort();
    const filtered = bank ? offers.filter(o => o.bank === bank) : offers;

    res.render('bank-offers', {
      title: bank ? `${bank} Card Offers This Week — IndiaOffers.in`
                  : 'All Bank & Card Offers in India This Week — IndiaOffers.in',
      meta: { description: 'HDFC, ICICI, SBI, Axis & UPI offers on Amazon, Flipkart, Zomato and more — aggregated in one place, updated daily.' },
      offers: filtered, banks, activeBank: bank || '', storeMap
    });
  } catch (err) { next(err); }
});

// ── Stores ────────────────────────────────────────────────────────────────────
router.get('/stores', async (req, res, next) => {
  try {
    const stores = await db.query(`
      SELECT s.*, (SELECT COUNT(*) FROM deals d WHERE d.store_id = s.id AND d.is_active = 1) AS deal_count
      FROM stores s WHERE s.is_active = 1 ORDER BY deal_count DESC`);
    res.render('stores', {
      title: 'All Stores — Deals, Coupons & Card Offers — IndiaOffers.in',
      meta: { description: 'Browse every store on IndiaOffers with live deals, coupons and applicable bank offers.' },
      stores
    });
  } catch (err) { next(err); }
});

router.get('/store/:slug', async (req, res, next) => {
  try {
    const stores = await db.query('SELECT * FROM stores WHERE slug = ? AND is_active = 1', [req.params.slug]);
    if (stores.length === 0) return res.status(404).render('404', { title: 'Store not found', meta: {} });
    const store = stores[0];

    const [dealsRaw, offers, coupons] = await Promise.all([
      db.query('SELECT * FROM deals WHERE store_id = ? AND is_active = 1 ORDER BY posted_at DESC LIMIT 40', [store.id]),
      activeBankOffers(),
      db.query('SELECT * FROM coupons WHERE store_id = ? AND is_active = 1', [store.id])
    ]);
    const storeOffers = offers.filter(o => !o.store_id || o.store_id === store.id);

    res.render('store', {
      title: `${store.name} Deals, Coupons & Card Offers — IndiaOffers.in`,
      meta: { description: `Live ${store.name} deals with the full savings stack, working coupons and this week's bank offers.` },
      store,
      deals: decorateDeals(dealsRaw, offers),
      coupons, storeOffers,
      storeMap: { [store.id]: store }
    });
  } catch (err) { next(err); }
});

// ── Search (nav box submits here) ─────────────────────────────────────────────
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  res.redirect(q ? `/deals?q=${encodeURIComponent(q)}` : '/deals');
});

// ── SEO plumbing ──────────────────────────────────────────────────────────────
router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /go/\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
});

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const [deals, stores] = await Promise.all([
      db.query('SELECT slug, updated_at FROM deals WHERE is_active = 1'),
      db.query('SELECT slug, created_at FROM stores WHERE is_active = 1')
    ]);
    const urls = [
      { loc: '/', pri: '1.0' }, { loc: '/deals', pri: '0.9' },
      { loc: '/bank-offers', pri: '0.9' }, { loc: '/stores', pri: '0.7' },
      ...deals.map(d => ({ loc: `/deal/${d.slug}`, pri: '0.8', mod: d.updated_at })),
      ...stores.map(s => ({ loc: `/store/${s.slug}`, pri: '0.6', mod: s.created_at }))
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map(u => `  <url><loc>${config.siteUrl}${u.loc}</loc>${u.mod ? `<lastmod>${String(u.mod).slice(0, 10)}</lastmod>` : ''}<priority>${u.pri}</priority></url>`).join('\n') +
      '\n</urlset>';
    res.type('application/xml').send(xml);
  } catch (err) { next(err); }
});

module.exports = router;
