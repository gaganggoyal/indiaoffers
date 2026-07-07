'use strict';

/** Public server-rendered pages. */

const router = require('express').Router();
const db = require('../db');
const config = require('../config');
const { savingsStack, activeBankOffers, decorateDeals } = require('../services/savings');
const { CATEGORIES, CATEGORY_TREE, CAT_ICONS, categoryName, descendantSlugs } = require('../data/taxonomy');

async function storesById() {
  const rows = await db.query('SELECT * FROM stores WHERE is_active = 1');
  return Object.fromEntries(rows.map(s => [s.id, s]));
}

const parseJson = v => { try { return JSON.parse(v || '[]'); } catch { return []; } };

// ── SEO: structured-data helpers ───────────────────────────────────────────────
const abs = p => `${config.siteUrl}${p}`;

// BreadcrumbList from [{ name, path }] — omit `path` on the final (current) crumb.
const breadcrumb = items => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.filter(Boolean).map((it, i) => ({
    '@type': 'ListItem', position: i + 1, name: it.name,
    ...(it.path ? { item: abs(it.path) } : {})
  }))
});

// Site-level entities — emitted once, on the homepage.
const WEBSITE_LD = {
  '@context': 'https://schema.org', '@type': 'WebSite',
  name: config.siteName, url: config.siteUrl,
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${config.siteUrl}/deals?q={search_term_string}` },
    'query-input': 'required name=search_term_string'
  }
};
const ORGANIZATION_LD = {
  '@context': 'https://schema.org', '@type': 'Organization',
  name: config.siteName, url: config.siteUrl,
  logo: abs('/img/logo-icon.png')
};

// ── Home ──────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const [heroRaw, dealsRaw, offers, storeMap, featuredCards] = await Promise.all([
      db.query(`SELECT * FROM deals WHERE is_active = 1 ORDER BY posted_at DESC LIMIT 3`),
      db.query(`SELECT * FROM deals WHERE is_active = 1 ORDER BY is_trending DESC, posted_at DESC LIMIT 12`),
      activeBankOffers(),
      storesById(),
      db.query(`SELECT * FROM bank_cards WHERE is_active = 1 ORDER BY is_featured DESC, sort_order ASC LIMIT 4`)
    ]);
    const heroDeals = decorateDeals(heroRaw, offers);
    const deals = decorateDeals(dealsRaw, offers);
    const topOffers = offers
      .slice()
      .sort((a, b) => (b.max_discount || b.discount_value * 40) - (a.max_discount || a.discount_value * 40))
      .slice(0, 6);

    res.render('home', {
      title: "IndiaOffers.in — Today's Best Deals & Discounts in India",
      meta: {
        description: "Handpicked deals with real discounts on Amazon, Flipkart and more — plus working coupons and card offers, all in one place.",
        jsonld: [WEBSITE_LD, ORGANIZATION_LD]
      },
      heroDeals, deals, topOffers, storeMap, featuredCards,
      categories: CATEGORIES, categoryTree: CATEGORY_TREE, catIcons: CAT_ICONS
    });
  } catch (err) { next(err); }
});

// ── Deals listing ─────────────────────────────────────────────────────────────
router.get('/deals', async (req, res, next) => {
  try {
    const { category, store, sort, q } = req.query;
    let where = 'WHERE d.is_active = 1';
    const params = [];
    // Accept a leaf slug or any branch (department / sub-group) and expand it to
    // the leaf categories beneath it.
    const catLeaves = category ? descendantSlugs(category) : [];
    if (catLeaves.length) {
      where += ` AND d.category IN (${catLeaves.map(() => '?').join(',')})`;
      params.push(...catLeaves);
    }
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
             : category ? `Best ${categoryName(category)} Deals Today — IndiaOffers.in`
             : 'Today\'s Best Deals & Discounts in India — IndiaOffers.in',
      meta: { description: 'Live deals with real discounts, working coupons and card offers across top Indian stores.' },
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
    const howTo = parseJson(deal.how_to);

    // JSON-LD: Product + Offer (rich results) and a breadcrumb trail.
    const productLd = {
      '@context': 'https://schema.org', '@type': 'Product',
      name: deal.title,
      ...(deal.image_url ? { image: [deal.image_url] } : {}),
      ...(deal.description ? { description: deal.description } : {}),
      sku: deal.id,
      offers: {
        '@type': 'Offer', priceCurrency: 'INR', price: deal.price,
        availability: 'https://schema.org/InStock',
        url: abs(`/deal/${deal.slug}`),
        ...(deal.expiry_date ? { priceValidUntil: String(deal.expiry_date).slice(0, 10) } : {}),
        seller: { '@type': 'Organization', name: store ? store.name : '' }
      }
    };
    const jsonld = [productLd, breadcrumb([
      { name: 'Home', path: '/' },
      { name: 'Deals', path: '/deals' },
      deal.category ? { name: categoryName(deal.category), path: `/deals?category=${deal.category}` } : null,
      { name: deal.title }
    ])];

    res.render('deal', {
      title: `${deal.title}${stack.price != null ? ' — ₹' + stack.price.toLocaleString('en-IN') : ''} | IndiaOffers.in`,
      meta: {
        description: `${deal.title}${stack.price != null ? ` at ₹${stack.price.toLocaleString('en-IN')}` : ''}${stack.discountPct ? ` (${stack.discountPct}% off)` : ''}${store ? ` on ${store.name}` : ''}. Check the latest price, coupons and offers on IndiaOffers.`,
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

// ── Bank cards — apply for cards ──────────────────────────────────────────────
router.get('/cards', async (req, res, next) => {
  try {
    const cards = await db.query('SELECT * FROM bank_cards WHERE is_active = 1 ORDER BY is_featured DESC, sort_order ASC');
    res.render('cards', {
      title: 'Best Credit Cards in India — Compare & Apply Online — IndiaOffers.in',
      meta: { description: 'Compare the best credit cards for shopping, cashback, travel and dining. See benefits, fees, eligibility and apply online in minutes.' },
      cards: cards.map(c => ({ ...c, benefitsList: parseJson(c.benefits) }))
    });
  } catch (err) { next(err); }
});

router.get('/card/:slug', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM bank_cards WHERE slug = ? AND is_active = 1', [req.params.slug]);
    if (rows.length === 0) return res.status(404).render('404', { title: 'Card not found', meta: {} });
    const card = rows[0];
    const [related, cardOffers] = await Promise.all([
      db.query('SELECT * FROM bank_cards WHERE bank = ? AND id != ? AND is_active = 1 LIMIT 3', [card.bank, card.id]),
      db.query('SELECT * FROM bank_offers WHERE bank_card_id = ? AND is_active = 1', [card.id])
    ]);
    res.render('card', {
      title: `${card.name} — Benefits, Fees & How to Apply — IndiaOffers.in`,
      meta: {
        description: `${card.name}: ${card.tagline || ''} Joining fee ${card.joining_fee || '—'}. See full benefits, eligibility and step-by-step how to apply.`,
        jsonld: breadcrumb([
          { name: 'Home', path: '/' },
          { name: 'Bank Cards', path: '/cards' },
          { name: card.name }
        ])
      },
      card: { ...card, benefitsList: parseJson(card.benefits), stepsList: parseJson(card.how_to_apply) },
      related, cardOffers
    });
  } catch (err) { next(err); }
});

// ── Buying guides — "Best AC", "Best TV" … ────────────────────────────────────
router.get('/guides', async (req, res, next) => {
  try {
    const guides = await db.query('SELECT * FROM guides WHERE is_active = 1 ORDER BY sort_order ASC, updated_at DESC');
    res.render('guides', {
      title: 'Buying Guides — Best AC, TV, Phone & More — IndiaOffers.in',
      meta: { description: 'Expert-picked best products in every category, with features, pros & cons, video reviews and exactly who each pick is for.' },
      guides, catIcons: CAT_ICONS
    });
  } catch (err) { next(err); }
});

router.get('/guide/:slug', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT * FROM guides WHERE slug = ? AND is_active = 1', [req.params.slug]);
    if (rows.length === 0) return res.status(404).render('404', { title: 'Guide not found', meta: {} });
    const guide = rows[0];
    const items = await db.query('SELECT * FROM guide_items WHERE guide_id = ? ORDER BY rank_no ASC', [guide.id]);

    const jsonld = [{
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: guide.title,
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem', position: i + 1, name: it.name
      }))
    }, breadcrumb([
      { name: 'Home', path: '/' },
      { name: 'Buying Guides', path: '/guides' },
      { name: guide.title }
    ])];

    res.render('guide', {
      title: `${guide.title} — IndiaOffers.in`,
      meta: { description: guide.subtitle || guide.intro || guide.title, image: guide.hero_image, type: 'article', jsonld },
      guide,
      items: items.map(it => ({
        ...it,
        featuresList: parseJson(it.features),
        prosList: parseJson(it.pros),
        consList: parseJson(it.cons),
        embed: youtubeEmbed(it.video_url)
      })),
      guideEmbed: youtubeEmbed(guide.video_url)
    });
  } catch (err) { next(err); }
});

// ── Stores ────────────────────────────────────────────────────────────────────
router.get('/stores', async (req, res, next) => {
  try {
    const stores = await db.query(`
      SELECT s.*, (SELECT COUNT(*) FROM deals d WHERE d.store_id = s.id AND d.is_active = 1) AS deal_count
      FROM stores s WHERE s.is_active = 1 ORDER BY deal_count DESC, s.name ASC`);
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
      meta: {
        description: `Live ${store.name} deals with real discounts, working coupons and card offers.`,
        jsonld: breadcrumb([
          { name: 'Home', path: '/' },
          { name: 'Stores', path: '/stores' },
          { name: store.name }
        ])
      },
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
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /go/\nDisallow: /account\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
});

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const [deals, stores, cards, guides] = await Promise.all([
      db.query('SELECT slug, updated_at FROM deals WHERE is_active = 1'),
      db.query('SELECT slug, created_at FROM stores WHERE is_active = 1'),
      db.query('SELECT slug FROM bank_cards WHERE is_active = 1'),
      db.query('SELECT slug, updated_at FROM guides WHERE is_active = 1')
    ]);
    const urls = [
      { loc: '/', pri: '1.0' }, { loc: '/deals', pri: '0.9' },
      { loc: '/bank-offers', pri: '0.9' }, { loc: '/cards', pri: '0.8' },
      { loc: '/guides', pri: '0.8' }, { loc: '/stores', pri: '0.7' },
      ...deals.map(d => ({ loc: `/deal/${d.slug}`, pri: '0.8', mod: d.updated_at })),
      ...cards.map(c => ({ loc: `/card/${c.slug}`, pri: '0.7' })),
      ...guides.map(g => ({ loc: `/guide/${g.slug}`, pri: '0.7', mod: g.updated_at })),
      ...stores.map(s => ({ loc: `/store/${s.slug}`, pri: '0.6', mod: s.created_at }))
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map(u => `  <url><loc>${config.siteUrl}${u.loc}</loc>${u.mod ? `<lastmod>${String(u.mod).slice(0, 10)}</lastmod>` : ''}<priority>${u.pri}</priority></url>`).join('\n') +
      '\n</urlset>';
    res.type('application/xml').send(xml);
  } catch (err) { next(err); }
});

// Turn a YouTube watch/short URL into an embeddable URL (null if not YouTube).
function youtubeEmbed(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

module.exports = router;
