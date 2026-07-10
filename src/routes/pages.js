'use strict';

/** Public server-rendered pages. */

const router = require('express').Router();
const db = require('../db');
const config = require('../config');
const { savingsStack, activeBankOffers, decorateDeals } = require('../services/savings');
const { sendMail } = require('../services/mailer');
const { CATEGORIES, CATEGORY_TREE, CAT_ICONS, categoryName, descendantSlugs } = require('../data/taxonomy');
const { COLLECTIONS, collectionBySlug } = require('../data/collections');

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
    // Hero banners show ONLY deals the admin ticked "Show in home page banners"
    // (is_trending) — no fallback; untick everything and the hero disappears.
    // The grid below shows the newest deals, but any deal with hotness > 0 is
    // pinned above the rest (higher number = higher on the page) regardless of
    // how old it is.
    const [heroRaw, dealsRaw, offers, storeMap, featuredCards] = await Promise.all([
      db.query(`SELECT * FROM deals WHERE is_active = 1 AND is_trending = 1 ORDER BY posted_at DESC LIMIT 3`),
      db.query(`SELECT * FROM deals WHERE is_active = 1 ORDER BY COALESCE(hotness, 0) DESC, posted_at DESC LIMIT 15`),
      activeBankOffers(),
      storesById(),
      db.query(`SELECT * FROM bank_cards WHERE is_active = 1 ORDER BY is_featured DESC, sort_order ASC LIMIT 4`)
    ]);
    const heroIds = new Set(heroRaw.map(d => d.id));
    const gridRaw = dealsRaw.filter(d => !heroIds.has(d.id)).slice(0, 12);
    const heroDeals = decorateDeals(heroRaw, offers);
    const deals = decorateDeals(gridRaw, offers);
    const topOffers = offers
      .slice()
      .sort((a, b) => (b.max_discount || b.discount_value * 40) - (a.max_discount || a.discount_value * 40))
      .slice(0, 6);

    res.render('home', {
      title: "IndiaOffers.in — India's No.1 Loot Deals, ₹1 Deals, Offers & Coupons",
      meta: {
        description: "India's No.1 site for loot deals, Re.1 deals, offers and coupon codes. Handpicked deals with real discounts on Amazon, Flipkart, Myntra & more — plus working coupons and bank card offers, all in one place.",
        keywords: 'loot deals, re.1 deals, rupee 1 deals, offers, coupons, coupon codes, deals today, online shopping deals, cashback offers, bank offers, discount coupons India',
        jsonld: [WEBSITE_LD, ORGANIZATION_LD]
      },
      heroDeals, deals, topOffers, storeMap, featuredCards, collections: COLLECTIONS,
      categories: CATEGORIES, categoryTree: CATEGORY_TREE, catIcons: CAT_ICONS
    });
  } catch (err) { next(err); }
});

// ── Deals listing ─────────────────────────────────────────────────────────────
router.get('/deals', async (req, res, next) => {
  try {
    const { category, store, q } = req.query;
    let where = 'WHERE d.is_active = 1';
    const params = [];
    // Accept a leaf slug or any branch (department / sub-group) and expand it to
    // the leaf categories beneath it. A deal matches if the branch contains its
    // primary category OR one of its SEO categories (comma-wrapped ,a,b,).
    const catLeaves = category ? descendantSlugs(category) : [];
    if (catLeaves.length) {
      const inList = catLeaves.map(() => '?').join(',');
      const seoLike = catLeaves.map(() => 'd.seo_categories LIKE ?').join(' OR ');
      where += ` AND (d.category IN (${inList}) OR ${seoLike})`;
      params.push(...catLeaves, ...catLeaves.map(s => `%,${s},%`));
    }
    if (store) { where += ' AND d.store_id = ?'; params.push(store); }
    if (q) { where += ' AND (d.title LIKE ? OR d.description LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
    const order = 'd.posted_at DESC';

    // Pagination — keeps each page light so it loads fast.
    const perPage = 24;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * perPage;

    const [countRows, rows, offers, storeMap] = await Promise.all([
      db.query(`SELECT COUNT(*) AS n FROM deals d ${where}`, params),
      db.query(`SELECT d.* FROM deals d ${where} ORDER BY ${order} LIMIT ${perPage} OFFSET ${offset}`, params),
      activeBankOffers(),
      storesById()
    ]);
    const total = countRows[0] ? Number(countRows[0].n) : 0;
    const totalPages = Math.max(1, Math.ceil(total / perPage));

    // SEO safety net: never show an empty category page to a Google visitor —
    // fall back to today's top deals with a friendly note.
    let deals = decorateDeals(rows, offers);
    let fallback = false;
    if (deals.length === 0 && (category || q) && page === 1) {
      const fb = await db.query(
        `SELECT d.* FROM deals d WHERE d.is_active = 1 ORDER BY d.posted_at DESC LIMIT ${perPage}`);
      deals = decorateDeals(fb, offers);
      fallback = true;
    }

    // Clean category filter: show the 5 top-level departments only. A leaf slug
    // (e.g. from a deal-card link) highlights its parent department.
    const activeDeptNode = category
      ? CATEGORY_TREE.find(d => d.slug === category || descendantSlugs(d.slug).includes(category))
      : null;

    res.render('deals', {
      title: q ? `Deals matching “${q}” — IndiaOffers.in`
             : category ? `Best ${categoryName(category)} Deals Today — IndiaOffers.in`
             : 'Today\'s Best Deals & Discounts in India — IndiaOffers.in',
      meta: { description: 'Live deals with real discounts, working coupons and card offers across top Indian stores.' },
      deals, storeMap, fallback,
      categoryTree: CATEGORY_TREE, catIcons: CAT_ICONS,
      catName: category ? categoryName(category) : '',
      activeDept: activeDeptNode ? activeDeptNode.slug : '',
      pagination: { page, totalPages, total, perPage },
      active: { category: category || '', store: store || '', q: q || '' }
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

// ── Company pages — About / Careers / Contact / Help / Become a Partner ───────
router.get('/about', (req, res) => res.render('about', {
  title: 'About Us — India\'s Home for Loot Deals & Coupons — IndiaOffers.in',
  meta: { description: 'IndiaOffers.in hunts loot deals, ₹1 steals, working coupons and bank-card offers across Amazon, Flipkart and more — founded by a deal hunter with 15+ years of online-shopping expertise.' }
}));

router.get('/careers', (req, res) => res.render('careers', {
  title: 'Careers — Become a Deal Hunter Partner — IndiaOffers.in',
  meta: { description: 'Join IndiaOffers as a Deal Hunter Partner: submit deals you find, and earn free gifts, vouchers and real money when they are approved.' }
}));

router.get('/help', (req, res) => res.render('help', {
  title: 'Help & FAQs — IndiaOffers.in',
  meta: { description: 'How deals, coupons, bank-card offers, alerts and the partner rewards programme work on IndiaOffers.in.' }
}));

router.get('/privacy', (req, res) => res.render('privacy', {
  title: 'Privacy Policy — IndiaOffers.in',
  meta: { description: 'What you share with IndiaOffers.in is voluntary and never sold. How we handle accounts, deal submissions, queries, cookies and affiliate links.' }
}));

router.get('/terms', (req, res) => res.render('terms', {
  title: 'Terms & Conditions — IndiaOffers.in',
  meta: { description: 'The friendly rulebook of IndiaOffers.in: we discover deals, stores sell products — prices change fast, so always verify at checkout. Partner programme and affiliate disclosure included.' }
}));

router.get('/become-partner', (req, res) => res.render('become-partner', {
  title: 'Become a Partner — Submit Deals, Earn Gifts & Real Money — IndiaOffers.in',
  meta: { description: 'Submit the deals you find on IndiaOffers.in and earn points redeemable for free gifts, shopping vouchers and real money. How to submit a deal in 15 seconds.' }
}));

const contactView = extra => Object.assign({
  title: 'Contact Us — IndiaOffers.in',
  meta: { description: 'Ask us anything about online shopping — deals, coupons, card offers, refunds. WhatsApp us or send a query straight to our care team.' },
  sent: false, error: null, form: {}
}, extra);

router.get('/contact', (req, res) => res.render('contact', contactView({})));

router.post('/contact', async (req, res, next) => {
  try {
    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 120);
    const email = String(b.email || '').trim().slice(0, 150);
    const mobile = String(b.mobile || '').trim().slice(0, 15);
    const topic = String(b.topic || '').trim().slice(0, 80);
    const message = String(b.message || '').trim().slice(0, 4000);
    if (!name || !message || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).render('contact', contactView({ error: 'Please fill your name, a valid email and your query.', form: b }));
    }
    // Keep a copy in the DB (visible in the admin panel), then email support.
    await db.query(
      'INSERT INTO contact_messages (id, name, email, mobile, topic, message) VALUES (?, ?, ?, ?, ?, ?)',
      [db.uid('cm'), name, email, mobile || null, topic || null, message]);
    await sendMail({
      to: config.support.contactTo,
      subject: `[IndiaOffers contact] ${topic || 'Query'} — ${name}`,
      text: `From: ${name} <${email}>${mobile ? `\nMobile: ${mobile}` : ''}\nTopic: ${topic}\n\n${message}`,
      html: `<p><b>From:</b> ${name} &lt;${email}&gt;${mobile ? `<br><b>Mobile:</b> ${mobile}` : ''}<br><b>Topic:</b> ${topic}</p><p>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`
    });
    res.render('contact', contactView({ sent: true }));
  } catch (err) { next(err); }
});

// ── Search (nav box submits here) ─────────────────────────────────────────────
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  res.redirect(q ? `/deals?q=${encodeURIComponent(q)}` : '/deals');
});

// ── SEO landing pages — loot deals, ₹1 deals, coupons, … ───────────────────────
// Keyword-targeted collection pages, driven by src/data/collections.js. Aliases
// 301-redirect to the canonical slug so link equity never splits.
const FAQ_LD = faqs => faqs && faqs.length ? {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faqs.map(f => ({
    '@type': 'Question', name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a }
  }))
} : null;

function renderCollection(col) {
  return async (req, res, next) => {
    try {
      const crumb = breadcrumb([
        { name: 'Home', path: '/' }, { name: 'Deals', path: '/deals' }, { name: col.nav }
      ]);
      const base = { collections: COLLECTIONS, col };

      if (col.type === 'coupons') {
        const [coupons, storeMap] = await Promise.all([
          db.query('SELECT * FROM coupons WHERE is_active = 1 ORDER BY is_verified DESC, created_at DESC LIMIT 120'),
          storesById()
        ]);
        return res.render('collection', {
          ...base, coupons, storeMap, deals: [],
          title: col.title,
          meta: { description: col.description, keywords: col.keywords, jsonld: [crumb, FAQ_LD(col.faqs)].filter(Boolean) }
        });
      }

      const [rows, offers, storeMap] = await Promise.all([
        db.query(`SELECT d.* FROM deals d WHERE d.is_active = 1 AND ${col.where} ORDER BY ${col.order} LIMIT 60`),
        activeBankOffers(),
        storesById()
      ]);
      const deals = decorateDeals(rows, offers);
      const itemList = {
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: col.h1,
        itemListElement: deals.slice(0, 30).map((d, i) => ({
          '@type': 'ListItem', position: i + 1, url: abs(`/deal/${d.slug}`), name: d.title
        }))
      };
      res.render('collection', {
        ...base, deals, storeMap, coupons: [],
        title: col.title,
        meta: { description: col.description, keywords: col.keywords, jsonld: [itemList, crumb, FAQ_LD(col.faqs)].filter(Boolean) }
      });
    } catch (err) { next(err); }
  };
}

COLLECTIONS.forEach(col => {
  router.get('/' + col.slug, renderCollection(col));
  (col.aliases || []).forEach(a => router.get('/' + a, (req, res) => res.redirect(301, '/' + col.slug)));
});

// ── SEO plumbing ──────────────────────────────────────────────────────────────
router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /go/\nDisallow: /account\nDisallow: /login\nDisallow: /register\nDisallow: /submit-deal\nDisallow: /api/\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
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
      { loc: '/about', pri: '0.5' }, { loc: '/careers', pri: '0.4' },
      { loc: '/contact', pri: '0.5' }, { loc: '/help', pri: '0.5' },
      { loc: '/become-partner', pri: '0.6' },
      { loc: '/privacy', pri: '0.3' }, { loc: '/terms', pri: '0.3' },
      ...COLLECTIONS.map(c => ({ loc: `/${c.slug}`, pri: '0.9' })),
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
