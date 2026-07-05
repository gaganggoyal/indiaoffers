/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  IndiaOffers.in — Amazon Associates Tracking Module
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  HOW AMAZON AFFILIATE TRACKING WORKS
 *  ────────────────────────────────────────────────────────────────────────
 *  Amazon does NOT have a server-side postback. Sales are tracked via:
 *    1. Associate tag in the URL  →  amazon.in/...?tag=YOUR_TAG-21
 *    2. Amazon's affiliate cookie (24h for direct, 90d for cart add)
 *    3. Amazon PA-API (Product Advertising API) for clicks/earnings report
 *    4. Amazon Reporting API (pull daily reports)
 *
 *  IndiaOffers workflow:
 *    User clicks deal → our redirect sets cookie + appends &tag=TAG-21
 *    → Amazon records the click → User buys
 *    → Amazon credits commission to our Associates account
 *    → We pull earnings via PA-API daily and match to our users
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ── Configuration ────────────────────────────────────────────────────────────
const AMAZON_CONFIG = {
  associateTag  : process.env.AMAZON_ASSOCIATE_TAG   || 'indiaoffers-21',
  accessKey     : process.env.AMAZON_ACCESS_KEY      || '',
  secretKey     : process.env.AMAZON_SECRET_KEY      || '',
  partnerTag    : process.env.AMAZON_PARTNER_TAG     || 'indiaoffers-21',
  region        : 'ap-south-1',   // India marketplace
  marketplace   : 'www.amazon.in',
  reportingEmail: process.env.AMAZON_REPORTING_EMAIL || ''  // SES/email for downloaded reports
};

// ── 1. URL Builder — always inject associate tag ──────────────────────────────
/**
 * Build a properly-tagged Amazon URL.
 * Strips any existing tag, injects ours, appends click tracking.
 *
 * @param {string} amazonUrl  - Any amazon.in product/search/deal URL
 * @param {string} clickId    - IndiaOffers internal click ID
 * @param {string} userId     - IndiaOffers user ID (for attribution)
 * @returns {string}          - Final redirect URL
 */
function buildAmazonAffiliateUrl(amazonUrl, clickId = '', userId = '') {
  try {
    const url = new URL(amazonUrl);

    // Ensure it's amazon.in
    if (!url.hostname.includes('amazon.in') && !url.hostname.includes('amzn.to')) {
      throw new Error('Not an Amazon India URL');
    }

    // Remove any existing associate tags
    url.searchParams.delete('tag');
    url.searchParams.delete('linkCode');
    url.searchParams.delete('linkId');

    // Inject our associate tag
    url.searchParams.set('tag', AMAZON_CONFIG.associateTag);

    // Append our own tracking params (stored in 1st-party cookie by redirect)
    if (clickId) url.searchParams.set('io_click', clickId);
    if (userId)  url.searchParams.set('io_uid',   userId);

    return url.toString();
  } catch (err) {
    console.error('[AmazonTracker] buildUrl failed:', err.message);
    return amazonUrl;
  }
}

// ── 2. Short URL / amzn.to expander ──────────────────────────────────────────
/**
 * Expand amzn.to short links to full URLs before tagging.
 * Must be called server-side (CORS blocks client-side HEAD requests).
 */
async function expandAmznShortUrl(shortUrl) {
  const res = await fetch(shortUrl, { method: 'HEAD', redirect: 'follow' });
  return res.url || shortUrl;
}

// ── 3. PA-API v5 — GetItems (product details, commission rates) ───────────────
/**
 * Fetch product info via Amazon PA-API.
 * Requires: aws4 npm package for SigV4 signing.
 * npm install aws4 node-fetch
 */
async function getProductInfo(asins = []) {
  const aws4   = require('aws4');
  const fetch  = require('node-fetch');

  const body = JSON.stringify({
    ItemIds     : asins,
    Resources   : ['ItemInfo.Title', 'ItemInfo.Features', 'Offers.Listings.Price',
                   'Offers.Listings.DeliveryInfo', 'Images.Primary.Medium'],
    PartnerTag  : AMAZON_CONFIG.associateTag,
    PartnerType : 'Associates',
    Marketplace : AMAZON_CONFIG.marketplace
  });

  const opts = aws4.sign({
    host   : 'webservices.amazon.in',
    path   : '/paapi5/getitems',
    method : 'POST',
    service: 'ProductAdvertisingAPI',
    region : AMAZON_CONFIG.region,
    headers: {
      'Content-Type' : 'application/json; charset=utf-8',
      'X-Amz-Target' : 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems'
    },
    body
  }, {
    accessKeyId    : AMAZON_CONFIG.accessKey,
    secretAccessKey: AMAZON_CONFIG.secretKey
  });

  const res  = await fetch('https://webservices.amazon.in/paapi5/getitems', {
    method : 'POST',
    headers: opts.headers,
    body
  });

  return res.json();
}

// ── 4. Earnings Report Polling ────────────────────────────────────────────────
/**
 * Amazon Associates does not have a real-time postback API.
 * Instead, we:
 *   a) Download the daily Earnings Report CSV from the Associates portal
 *      (scheduled at 06:00 IST via cron)
 *   b) Parse it and match click IDs stored in our database
 *   c) Credit cashback to users
 *
 * Amazon report columns: Date, OrderId, ASIN, Title, Qty, Revenue, Commission
 *
 * AUTOMATION NOTE:
 *   Amazon does not provide an API for downloading reports.
 *   Use Playwright/Puppeteer to log in and download, OR
 *   use the "Associates Central Reporting" CSV email feature.
 */

/**
 * Parse Amazon Associates CSV earnings report.
 * @param {string} csvText  - Contents of the downloaded CSV file
 * @returns {Array<Object>} - Parsed orders
 */
function parseAmazonEarningsReport(csvText) {
  const lines  = csvText.trim().split('\n');
  const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const orders = [];

  for (let i = 1; i < lines.length; i++) {
    const cols  = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    const row   = {};
    header.forEach((h, idx) => { row[h] = cols[idx] || ''; });

    if (!row['Order ID'] && !row['order_id']) continue;

    orders.push({
      date       : row['Date']                  || row['date']       || '',
      orderId    : row['Order ID']              || row['order_id']   || '',
      asin       : row['ASIN']                  || row['asin']       || '',
      title      : row['Title']                 || row['title']      || '',
      qty        : parseInt(row['Quantity']     || row['qty']   || 1, 10),
      revenue    : parseFloat(row['Revenue']    || row['revenue'] || 0),
      commission : parseFloat(row['Commission'] || row['commission'] || 0),
      category   : row['Product Category']      || ''
    });
  }

  return orders;
}

/**
 * Match parsed Amazon orders to IndiaOffers click records.
 * This runs server-side after downloading the daily report.
 *
 * @param {Array}  amazonOrders  - From parseAmazonEarningsReport()
 * @param {Object} db            - Your DB client (Postgres, MySQL, Firestore, etc.)
 */
async function reconcileAmazonOrders(amazonOrders, db) {
  const results = { credited: 0, skipped: 0, errors: [] };

  for (const order of amazonOrders) {
    try {
      // Check if already processed
      const existing = await db.query(
        'SELECT id FROM amazon_sales WHERE amazon_order_id = ?',
        [order.orderId]
      );
      if (existing.length > 0) { results.skipped++; continue; }

      // Find the click that led to this purchase
      // We use a 24-hour window before the order date
      const clicks = await db.query(`
        SELECT c.id, c.user_id, c.clicked_at
        FROM affiliate_clicks c
        WHERE c.store = 'amazon'
          AND c.clicked_at BETWEEN DATE_SUB(?, INTERVAL 90 DAY) AND ?
          AND c.user_id IS NOT NULL
        ORDER BY c.clicked_at DESC
        LIMIT 1
      `, [order.date, order.date]);

      if (clicks.length === 0) { results.skipped++; continue; }

      const click = clicks[0];

      // Calculate cashback (we keep ~40% of commission, give 60% to user)
      const USER_SHARE    = 0.60;
      const cashbackAmount = parseFloat((order.commission * USER_SHARE).toFixed(2));

      if (cashbackAmount < 1) { results.skipped++; continue; }

      // Record the sale
      await db.query(`
        INSERT INTO amazon_sales
          (amazon_order_id, asin, title, revenue, commission, cashback_amount,
           user_id, click_id, order_date, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', NOW())
      `, [order.orderId, order.asin, order.title, order.revenue,
          order.commission, cashbackAmount, click.user_id, click.id, order.date]);

      // Credit user wallet
      await db.query(`
        UPDATE users SET wallet = wallet + ?, total_earned = total_earned + ?
        WHERE id = ?
      `, [cashbackAmount, cashbackAmount, click.user_id]);

      results.credited++;
    } catch (err) {
      results.errors.push({ orderId: order.orderId, error: err.message });
    }
  }

  console.log('[Amazon Reconcile] Done:', results);
  return results;
}

// ── 5. Click tracking (server-side redirect) ──────────────────────────────────
/**
 * This function runs on your redirect route:
 *   GET /go/amazon?url=ENCODED_URL&uid=USER_ID&deal=DEAL_ID
 *
 * It:
 *  a) Logs the click in DB
 *  b) Sets io_click cookie
 *  c) Redirects to tagged Amazon URL
 */
async function handleAmazonClick(req, res, db, ctx = {}) {
  const { url: rawUrl, uid, deal } = req.query;

  if (!rawUrl) return res.status(400).send('Missing url');

  // Generate unique click ID
  const clickId = `amz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Expand amzn.to if needed
  let finalUrl = rawUrl;
  if (rawUrl.includes('amzn.to')) {
    try { finalUrl = await expandAmznShortUrl(rawUrl); } catch (e) {}
  }

  // Build tagged URL
  const taggedUrl = buildAmazonAffiliateUrl(finalUrl, clickId, uid);

  // Log click in DB
  try {
    await db.query(`
      INSERT INTO affiliate_clicks (id, user_id, deal_id, store, raw_url, tagged_url, ip_address, user_agent, referrer, clicked_at)
      VALUES (?, ?, ?, 'amazon', ?, ?, ?, ?, ?, NOW())
    `, [clickId, uid || null, deal || null, rawUrl, taggedUrl,
        ctx.ip || req.ip || '', ctx.userAgent || req.headers['user-agent'] || '', ctx.referrer || '']);
  } catch (err) {
    console.error('[AmazonTracker] DB click log failed:', err.message);
  }

  // Set tracking cookie (90 days, to cover Amazon cart adds).
  // Must be readable by pixel.js, and must NOT set domain/secure on localhost.
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOpts = ctx.cookieOpts ? ctx.cookieOpts(90) : {
    maxAge: 90 * 24 * 60 * 60 * 1000, httpOnly: false, secure: isProd, sameSite: 'Lax',
    ...(isProd ? { domain: '.indiaoffers.in' } : {})
  };
  res.cookie('io_click', clickId, cookieOpts);

  // 302 redirect (never cacheable — every click must be logged)
  res.redirect(302, taggedUrl);
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  buildAmazonAffiliateUrl,
  expandAmznShortUrl,
  getProductInfo,
  parseAmazonEarningsReport,
  reconcileAmazonOrders,
  handleAmazonClick,
  AMAZON_CONFIG
};
