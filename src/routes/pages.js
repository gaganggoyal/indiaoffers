'use strict';

/** Public server-rendered pages. */

const router = require('express').Router();
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { savingsStack, activeBankOffers, decorateDeals } = require('../services/savings');
const { sendMail } = require('../services/mailer');
const { CATEGORIES, CATEGORY_TREE, CAT_ICONS, categoryName, findNode, descendantSlugs } = require('../data/taxonomy');
const { COLLECTIONS, collectionBySlug } = require('../data/collections');
const { CATEGORY_CONTENT } = require('../data/category-content');

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

// FAQPage from [{ q, a }] — null-safe so callers can pass content that may lack FAQs.
const FAQ_LD = faqs => faqs && faqs.length ? {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faqs.map(f => ({
    '@type': 'Question', name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a }
  }))
} : null;

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
    // The hero mixes three sources, capped at 3 slots: admin-made image
    // banners (/admin/banners) always come first by sort order, then
    // deals/guides ticked "Show in home page banners" (is_trending) by
    // recency. No fallback — deactivate/untick everything and the hero
    // disappears. The grid below shows the newest deals, but any deal with
    // hotness > 0 is pinned above the rest (higher number = higher on the
    // page) regardless of how old it is.
    const [heroRaw, heroGuidesRaw, bannersRaw, offers, storeMap, featuredCards] = await Promise.all([
      db.query(`SELECT * FROM deals WHERE is_active = 1 AND is_trending = 1 ORDER BY posted_at DESC LIMIT 3`),
      db.query(`SELECT * FROM guides WHERE is_active = 1 AND is_trending = 1 ORDER BY updated_at DESC LIMIT 3`),
      db.query(`SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC LIMIT 3`),
      activeBankOffers(),
      storesById(),
      db.query(`SELECT * FROM bank_cards WHERE is_active = 1 ORDER BY is_featured DESC, sort_order ASC LIMIT 4`)
    ]);
    const when = v => new Date(v || 0).getTime() || 0;
    const dated = [
      ...decorateDeals(heroRaw, offers).map(d => ({ type: 'deal', d, ts: when(d.posted_at) })),
      ...heroGuidesRaw.map(g => ({ type: 'guide', g, ts: when(g.updated_at || g.created_at) }))
    ].sort((a, b) => b.ts - a.ts);
    const heroItems = [
      ...bannersRaw.map(b => ({ type: 'banner', b })),
      ...dated
    ].slice(0, 3);

    // The grid paginates over every active deal. Hero-featured deals are
    // excluded in SQL (not post-filtered) so page boundaries stay stable.
    const perPage = 12;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const heroIds = heroItems.filter(h => h.type === 'deal').map(h => h.d.id);
    const notHero = heroIds.length ? ` AND id NOT IN (${heroIds.map(() => '?').join(',')})` : '';
    const [countRows, gridRaw] = await Promise.all([
      db.query(`SELECT COUNT(*) AS n FROM deals WHERE is_active = 1${notHero}`, heroIds),
      db.query(`SELECT * FROM deals WHERE is_active = 1${notHero}
                ORDER BY COALESCE(hotness, 0) DESC, posted_at DESC
                LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`, heroIds)
    ]);
    const total = countRows[0] ? Number(countRows[0].n) : 0;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const deals = decorateDeals(gridRaw, offers);
    const topOffers = offers
      .slice()
      .sort((a, b) => (b.max_discount || b.discount_value * 40) - (a.max_discount || a.discount_value * 40))
      .slice(0, 6);

    // The first hero slot is the mobile LCP element, rendered as a CSS
    // background-image the preload scanner can't see — hint it in <head>.
    // Must produce the exact URL home.ejs renders (thumb() for deals/guides).
    const h0 = heroItems[0];
    const preloadImage = !h0 ? null
      : h0.type === 'banner' ? h0.b.image_url
      : h0.type === 'deal' ? res.locals.thumb(h0.d.image_url, 800)
      : res.locals.thumb(h0.g.hero_image, 800);

    res.render('home', {
      title: "IndiaOffers.in — India's No.1 Loot Deals, ₹1 Deals, Offers & Coupons",
      meta: {
        description: "India's No.1 site for loot deals, Re.1 deals, offers and coupon codes. Handpicked deals with real discounts on Amazon, Flipkart, Myntra & more — plus working coupons and bank card offers, all in one place.",
        keywords: 'loot deals, re.1 deals, rupee 1 deals, offers, coupons, coupon codes, deals today, online shopping deals, cashback offers, bank offers, discount coupons India',
        jsonld: [WEBSITE_LD, ORGANIZATION_LD],
        preloadImage
      },
      heroItems, deals, topOffers, storeMap, featuredCards, collections: COLLECTIONS,
      categories: CATEGORIES, categoryTree: CATEGORY_TREE, catIcons: CAT_ICONS,
      pagination: { page, totalPages, total, perPage },
      welcome: req.query.welcome === '1'
    });
  } catch (err) { next(err); }
});

// ── Deals listing ─────────────────────────────────────────────────────────────
router.get('/deals', async (req, res, next) => {
  try {
    const { category, store, q } = req.query;
    // Pure category browses live on clean, indexable hub URLs — send the old
    // query-param form there permanently so link equity consolidates.
    if (category && !store && !q && findNode(category)) {
      const page = parseInt(req.query.page, 10) || 1;
      return res.redirect(301, `/category/${category}${page > 1 ? `?page=${page}` : ''}`);
    }
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
    if (q) {
      // Tokenized: every word must appear in the title or description.
      q.trim().split(/\s+/).slice(0, 6).forEach(t => {
        where += ' AND (d.title LIKE ? OR d.description LIKE ?)';
        params.push(`%${t}%`, `%${t}%`);
      });
    }
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
      meta: {
        description: 'Live deals with real discounts, working coupons and card offers across top Indian stores.',
        // Search-result and store-filtered variants are thin duplicates of the
        // main listing — keep them crawlable but out of the index.
        ...(q || store ? { robots: 'noindex,follow' } : {})
      },
      deals, storeMap, fallback,
      categoryTree: CATEGORY_TREE, catIcons: CAT_ICONS,
      catName: category ? categoryName(category) : '',
      activeDept: activeDeptNode ? activeDeptNode.slug : '',
      pagination: { page, totalPages, total, perPage },
      active: { category: category || '', store: store || '', q: q || '' }
    });
  } catch (err) { next(err); }
});

// ── Category hubs — /category/mobiles, /category/dept-electronics, … ──────────
// Clean, indexable landing pages for every taxonomy node, each with unique
// editorial content (src/data/category-content.js), FAQs and ItemList JSON-LD.
// These are the pages that compete for "best <category> deals" searches.
router.get('/category/:slug', async (req, res, next) => {
  try {
    const node = findNode(req.params.slug);
    if (!node) return res.status(404).render('404', { title: 'Category not found', meta: {} });
    const slug = node.slug;
    const content = CATEGORY_CONTENT[slug] || null;

    const leaves = descendantSlugs(slug);
    const inList = leaves.map(() => '?').join(',');
    const seoLike = leaves.map(() => 'd.seo_categories LIKE ?').join(' OR ');
    const where = `WHERE d.is_active = 1 AND (d.category IN (${inList}) OR ${seoLike})`;
    const params = [...leaves, ...leaves.map(s => `%,${s},%`)];

    const perPage = 24;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const [countRows, rows, offers, storeMap] = await Promise.all([
      db.query(`SELECT COUNT(*) AS n FROM deals d ${where}`, params),
      db.query(`SELECT d.* FROM deals d ${where} ORDER BY COALESCE(d.hotness, 0) DESC, d.posted_at DESC
                LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`, params),
      activeBankOffers(),
      storesById()
    ]);
    const total = countRows[0] ? Number(countRows[0].n) : 0;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const deals = decorateDeals(rows, offers);

    // Sibling/child hubs for internal linking: a department links its leaves,
    // a leaf links the other leaves of its department.
    const dept = CATEGORY_TREE.find(d => d.slug === slug || descendantSlugs(d.slug).includes(slug));
    const siblingLeaves = dept ? descendantSlugs(dept.slug).filter(s => s !== slug) : [];

    const itemList = deals.length ? {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: `Best ${node.name} Deals`,
      itemListElement: deals.slice(0, 30).map((d, i) => ({
        '@type': 'ListItem', position: i + 1, url: abs(`/deal/${d.slug}`), name: d.title
      }))
    } : null;
    const crumb = breadcrumb([
      { name: 'Home', path: '/' }, { name: 'Deals', path: '/deals' }, { name: node.name }
    ]);

    res.render('category', {
      title: `Best ${node.name} Deals & Offers Today (${new Date().getFullYear()}) — IndiaOffers.in`,
      meta: {
        description: content
          ? content.intro.slice(0, 150).replace(/\s+\S*$/, '') + '…'
          : `Today's best ${node.name.toLowerCase()} deals with real discounts, working coupons and bank card offers — verified by IndiaOffers.`,
        canonical: `/category/${slug}${page > 1 ? `?page=${page}` : ''}`,
        jsonld: [itemList, crumb, FAQ_LD(content && content.faqs)].filter(Boolean)
      },
      node, content, deals, storeMap,
      dept, siblingLeaves, catIcons: CAT_ICONS, categoryName,
      pagination: { page, totalPages, total, perPage }
    });
  } catch (err) { next(err); }
});

// ── Deal detail ───────────────────────────────────────────────────────────────
router.get('/deal/:slug', async (req, res, next) => {
  try {
    // Expired/retired deals stay live as pages (with an "expired" notice and
    // fresh alternatives) instead of 404ing — the URL keeps its search ranking
    // and the visitor still gets something useful.
    const rows = await db.query('SELECT * FROM deals WHERE slug = ?', [req.params.slug]);
    if (rows.length === 0) return res.status(404).render('404', { title: 'Deal not found', meta: {} });
    const deal = rows[0];
    const today = new Date().toISOString().slice(0, 10);
    const expired = !deal.is_active
      || (deal.expiry_date && String(deal.expiry_date).slice(0, 10) < today);

    const [stores, offers, related, coupons] = await Promise.all([
      db.query('SELECT * FROM stores WHERE id = ?', [deal.store_id]),
      activeBankOffers(),
      db.query('SELECT * FROM deals WHERE store_id = ? AND id != ? AND is_active = 1 ORDER BY posted_at DESC LIMIT 4', [deal.store_id, deal.id]),
      db.query('SELECT * FROM coupons WHERE store_id = ? AND is_active = 1 LIMIT 4', [deal.store_id])
    ]);
    const store = stores[0];
    const stack = savingsStack(deal, offers);
    const howTo = parseJson(deal.how_to);

    // JSON-LD: Product + Offer (rich results) and a breadcrumb trail. Google
    // rejects Offers without a price and relative image URLs, so both are
    // guarded/absolutised here.
    const productLd = {
      '@context': 'https://schema.org', '@type': 'Product',
      name: deal.title,
      ...(deal.image_url ? { image: [/^https?:\/\//.test(deal.image_url) ? deal.image_url : abs(deal.image_url)] } : {}),
      ...(deal.description ? { description: deal.description } : {}),
      sku: deal.id,
      ...(deal.price != null ? { offers: {
        '@type': 'Offer', priceCurrency: 'INR', price: deal.price,
        availability: expired ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        url: abs(`/deal/${deal.slug}`),
        ...(deal.expiry_date ? { priceValidUntil: String(deal.expiry_date).slice(0, 10) } : {}),
        seller: { '@type': 'Organization', name: store ? store.name : '' }
      } } : {})
    };
    const jsonld = [productLd, breadcrumb([
      { name: 'Home', path: '/' },
      { name: 'Deals', path: '/deals' },
      deal.category ? { name: categoryName(deal.category), path: `/category/${deal.category}` } : null,
      { name: deal.title }
    ])];

    res.render('deal', {
      title: `${deal.title}${stack.price != null ? ' — ₹' + stack.price.toLocaleString('en-IN') : ''} | IndiaOffers.in`,
      meta: {
        description: `${deal.title}${stack.price != null ? ` at ₹${stack.price.toLocaleString('en-IN')}` : ''}${stack.discountPct ? ` (${stack.discountPct}% off)` : ''}${store ? ` on ${store.name}` : ''}. Check the latest price, coupons and offers on IndiaOffers.`,
        image: deal.image_url,
        jsonld
      },
      deal, store, stack, howTo, expired, categoryName,
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
      meta: { description: 'Compare the best credit cards for shopping, travel, UPI and everyday spends. See benefits, fees, eligibility and apply online in minutes.' },
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

router.get('/how-we-verify', (req, res) => res.render('how-we-verify', {
  title: 'How We Verify Deals — Our Testing & Editorial Policy — IndiaOffers.in',
  meta: { description: 'Every deal on IndiaOffers.in is checked by a human before it goes live: real price vs MRP, working coupon codes, stackable card offers — with a visible last-verified timestamp and automatic retirement of expired deals.' }
}));

router.get('/become-partner', (req, res) => res.render('become-partner', {
  title: 'Become a Partner — Submit Deals, Earn Gifts & Real Money — IndiaOffers.in',
  meta: { description: 'Submit the deals you find on IndiaOffers.in and earn points redeemable for free gifts, shopping vouchers and real money. How to submit a deal in 15 seconds.' }
}));

// ── Contact-form bot defence ──────────────────────────────────────────────────
// Invisible to humans (no captcha):
//  1. Honeypot — a hidden "website" field; bots auto-fill it, people never see it.
//  2. Time trap — the form carries an HMAC-signed render timestamp; submissions
//     arriving faster than a human can type (< 4 s) or from a stale/forged form
//     (> 6 h) are dropped.
//  3. Heuristics — Cyrillic text or 3+ links in the message (the actual spam we get).
//  4. Rate limit — max 3 messages per IP per hour.
// Trapped bots get the normal "sent" page so there is nothing to learn from,
// but nothing is stored or emailed.
const signContactTs = ts => crypto.createHmac('sha256', config.jwtSecret).update('contact:' + ts).digest('hex').slice(0, 24);
const contactToken = () => { const ts = Date.now(); return ts + '.' + signContactTs(ts); };
const contactTokenAge = tok => {
  const [ts, sig] = String(tok || '').split('.');
  if (!ts || !sig || sig !== signContactTs(ts)) return null;
  return Date.now() - Number(ts);
};
const contactHits = new Map();                        // ip → recent submit times
const contactRateLimited = ip => {
  const now = Date.now();
  const recent = (contactHits.get(ip) || []).filter(t => now - t < 36e5);
  recent.push(now);
  contactHits.set(ip, recent);
  if (contactHits.size > 5000) {                      // don't grow unbounded
    for (const [k, v] of contactHits) if (v.every(t => now - t >= 36e5)) contactHits.delete(k);
  }
  return recent.length > 3;
};
const looksLikeSpam = text =>
  /[Ѐ-ӿ]/.test(text) || (text.match(/https?:\/\//gi) || []).length >= 3;

const contactView = extra => Object.assign({
  title: 'Contact Us — IndiaOffers.in',
  meta: { description: 'Ask us anything about online shopping — deals, coupons, card offers, refunds. WhatsApp us or send a query straight to our care team.' },
  sent: false, error: null, form: {}, fk: contactToken()
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
    // Bot checks — fail silently with the normal success page.
    const age = contactTokenAge(b.fk);
    if (String(b.website || '').trim() !== ''            // honeypot filled
        || age === null || age < 4000 || age > 216e5     // no/forged/instant/stale token
        || looksLikeSpam(`${name} ${topic} ${message}`)) {
      return res.render('contact', contactView({ sent: true }));
    }
    if (contactRateLimited(req.ip)) {
      return res.status(429).render('contact', contactView({
        error: 'You have sent a few messages in a short time — please wait an hour, or WhatsApp us for anything urgent.', form: b
      }));
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

// ── Search (nav box submits here) — one box for the whole site ────────────────
// Matches deals, stores, coupons, bank cards, guides, plus category hubs and
// collection pages. Multi-word queries are tokenized: every word must match.
router.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    const tokens = q ? q.split(' ').slice(0, 6) : [];
    const meta = {
      description: 'Search IndiaOffers — deals, stores, coupons, card offers, bank cards and buying guides.',
      robots: 'noindex,follow'
    };

    if (!tokens.length) {
      const topStores = await db.query(`
        SELECT s.*, (SELECT COUNT(*) FROM deals d WHERE d.store_id = s.id AND d.is_active = 1) AS deal_count
        FROM stores s WHERE s.is_active = 1 ORDER BY deal_count DESC, s.name ASC LIMIT 12`);
      return res.render('search', {
        title: 'Search — IndiaOffers.in', meta,
        q: '', searchQ: '', results: null, total: 0, topStores, catIcons: CAT_ICONS
      });
    }

    const and = expr => tokens.map(() => expr).join(' AND ');
    const lp = n => tokens.flatMap(t => Array(n).fill(`%${t}%`));

    const [storeRows, dealRows, couponRows, cardRows, guideRows, offers, storeMap] = await Promise.all([
      db.query(`
        SELECT s.*, (SELECT COUNT(*) FROM deals d WHERE d.store_id = s.id AND d.is_active = 1) AS deal_count
        FROM stores s WHERE s.is_active = 1 AND ${and('(s.name LIKE ? OR s.slug LIKE ?)')}
        ORDER BY deal_count DESC, s.name ASC LIMIT 12`, lp(2)),
      db.query(`
        SELECT d.* FROM deals d WHERE d.is_active = 1 AND ${and('(d.title LIKE ? OR d.description LIKE ?)')}
        ORDER BY CASE WHEN ${and('d.title LIKE ?')} THEN 0 ELSE 1 END, d.posted_at DESC LIMIT 24`,
        [...lp(2), ...lp(1)]),
      db.query(`
        SELECT c.*, s.name AS store_name, s.slug AS store_slug
        FROM coupons c JOIN stores s ON s.id = c.store_id
        WHERE c.is_active = 1 AND ${and('(c.title LIKE ? OR c.code LIKE ? OR s.name LIKE ?)')}
        ORDER BY c.is_verified DESC, c.created_at DESC LIMIT 12`, lp(3)),
      db.query(`
        SELECT * FROM bank_cards WHERE is_active = 1 AND ${and('(name LIKE ? OR bank LIKE ?)')}
        ORDER BY is_featured DESC, sort_order ASC LIMIT 8`, lp(2)),
      db.query(`
        SELECT * FROM guides WHERE is_active = 1 AND ${and('(title LIKE ? OR subtitle LIKE ?)')}
        ORDER BY updated_at DESC LIMIT 8`, lp(2)),
      activeBankOffers(),
      storesById()
    ]);

    // Category hubs, collection pages and live card offers are small in-memory
    // lists — match them without extra queries.
    const tl = tokens.map(t => t.toLowerCase());
    const matchName = s => { const n = String(s).toLowerCase(); return tl.every(t => n.includes(t)); };
    const catHits = [];
    for (const dept of CATEGORY_TREE) {
      if (matchName(dept.name)) catHits.push(dept);
      for (const grp of dept.children) {
        if (matchName(grp.name)) catHits.push(grp);
        for (const leaf of grp.children) if (matchName(leaf.name)) catHits.push(leaf);
      }
    }
    const colHits = COLLECTIONS.filter(c => matchName(`${c.nav} ${c.h1 || ''}`));
    const offerHits = offers.filter(o => matchName(`${o.title || ''} ${o.bank || ''}`)).slice(0, 8);

    const deals = decorateDeals(dealRows, offers);
    const results = {
      stores: storeRows, deals, coupons: couponRows, cards: cardRows, guides: guideRows,
      cats: catHits.slice(0, 10), cols: colHits.slice(0, 6), offers: offerHits
    };
    const total = storeRows.length + deals.length + couponRows.length + cardRows.length
      + guideRows.length + results.cats.length + results.cols.length + offerHits.length;

    res.render('search', {
      title: `“${q}” — Search — IndiaOffers.in`, meta,
      q, searchQ: q, results, total, storeMap, topStores: [], catIcons: CAT_ICONS
    });
  } catch (err) { next(err); }
});

// ── SEO landing pages — loot deals, ₹1 deals, coupons, … ───────────────────────
// Keyword-targeted collection pages, driven by src/data/collections.js. Aliases
// 301-redirect to the canonical slug so link equity never splits.
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
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /go/\nDisallow: /account\nDisallow: /login\nDisallow: /register\nDisallow: /submit-deal\nDisallow: /search\nDisallow: /api/\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
});

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const [deals, stores, cards, guides] = await Promise.all([
      db.query('SELECT slug, updated_at, verified_at FROM deals WHERE is_active = 1'),
      db.query('SELECT slug, created_at FROM stores WHERE is_active = 1'),
      db.query('SELECT slug FROM bank_cards WHERE is_active = 1'),
      db.query('SELECT slug, updated_at FROM guides WHERE is_active = 1')
    ]);
    // Category hubs: departments and leaves (sub-groups are navigation-only).
    const catUrls = [];
    for (const dept of CATEGORY_TREE) {
      catUrls.push({ loc: `/category/${dept.slug}`, pri: '0.9' });
      for (const grp of dept.children) for (const leaf of grp.children)
        catUrls.push({ loc: `/category/${leaf.slug}`, pri: '0.8' });
    }
    const urls = [
      { loc: '/', pri: '1.0' }, { loc: '/deals', pri: '0.9' },
      { loc: '/bank-offers', pri: '0.9' }, { loc: '/cards', pri: '0.8' },
      { loc: '/guides', pri: '0.8' }, { loc: '/stores', pri: '0.7' },
      { loc: '/about', pri: '0.5' }, { loc: '/careers', pri: '0.4' },
      { loc: '/contact', pri: '0.5' }, { loc: '/help', pri: '0.5' },
      { loc: '/become-partner', pri: '0.6' }, { loc: '/how-we-verify', pri: '0.5' },
      { loc: '/privacy', pri: '0.3' }, { loc: '/terms', pri: '0.3' },
      ...COLLECTIONS.map(c => ({ loc: `/${c.slug}`, pri: '0.9' })),
      ...catUrls,
      ...deals.map(d => ({ loc: `/deal/${d.slug}`, pri: '0.8', mod: d.verified_at || d.updated_at })),
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
