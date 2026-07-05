/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  IndiaOffers.in — Flipkart Affiliate Tracking Module
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  HOW FLIPKART AFFILIATE TRACKING WORKS
 *  ────────────────────────────────────────────────────────────────────────
 *  Flipkart has TWO affiliate programs:
 *
 *  A) Flipkart Affiliate (affiliate.flipkart.com)
 *     - URL-based tracking: append &affid=YOUR_ID&affExtParam1=CLICK_ID
 *     - Real-time postback: Flipkart POSTs to your callback URL on every sale
 *     - Postback URL set in: affiliate.flipkart.com › Settings › Postback URL
 *
 *  B) vCommission / Admitad / DAN networks (3rd-party networks)
 *     - Use their postback system
 *     - Often more reliable for high-volume publishers
 *
 *  IndiaOffers uses BOTH:
 *    - Direct Flipkart Affiliate for primary tracking
 *    - Network backup for reconciliation
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const FLIPKART_CONFIG = {
  affiliateId  : process.env.FLIPKART_AFFILIATE_ID   || 'indiaoffers',
  apiKey       : process.env.FLIPKART_AFFILIATE_KEY  || '',
  trackingId   : process.env.FLIPKART_TRACKING_ID    || 'indoffers01',
  postbackToken: process.env.FLIPKART_POSTBACK_TOKEN || '',  // Verify postbacks with this
  apiBaseUrl   : 'https://affiliate-api.flipkart.io/affiliate'
};

// ── 1. Build Flipkart Affiliate URL ──────────────────────────────────────────
/**
 * Build a properly-tracked Flipkart URL.
 *
 * Flipkart affiliate params:
 *   affid          = your affiliate ID
 *   affExtParam1   = sub-ID / click ID (appears in reports)
 *   affExtParam2   = optional 2nd sub-ID (e.g. user ID)
 *
 * @param {string} flipkartUrl - Any flipkart.com product/listing URL
 * @param {string} clickId     - IndiaOffers click ID
 * @param {string} userId      - IndiaOffers user ID
 * @returns {string}
 */
function buildFlipkartAffiliateUrl(flipkartUrl, clickId = '', userId = '') {
  try {
    const url = new URL(flipkartUrl);

    if (!url.hostname.includes('flipkart.com') && !url.hostname.includes('fkrt.it')) {
      throw new Error('Not a Flipkart URL');
    }

    // Remove stale affiliate params
    ['affid', 'affExtParam1', 'affExtParam2', 'otracker', 'pid'].forEach(p => {
      url.searchParams.delete(p);
    });

    // Inject affiliate tracking
    url.searchParams.set('affid',        FLIPKART_CONFIG.affiliateId);
    url.searchParams.set('affExtParam1', clickId);   // visible in FK reports
    url.searchParams.set('affExtParam2', userId);    // optional

    return url.toString();
  } catch (err) {
    console.error('[FlipkartTracker] buildUrl failed:', err.message);
    return flipkartUrl;
  }
}

// ── 2. Postback Handler (Express route) ──────────────────────────────────────
/**
 * Flipkart fires a GET request to your postback URL when a sale occurs.
 *
 * SETUP: In affiliate.flipkart.com › Settings, set postback URL to:
 *   https://api.indiaoffers.in/postback/flipkart?token=YOUR_POSTBACK_TOKEN
 *
 * Flipkart sends these query params on sale:
 *   orderId        - Flipkart order ID
 *   orderAmount    - Order value in ₹
 *   commissionAmount - Your commission
 *   affExtParam1   - click ID you passed in the URL (sub-ID 1)
 *   affExtParam2   - user ID you passed
 *   status         - 'Approved' | 'Pending' | 'Cancelled'
 *   productName    - Product name
 *   category       - Product category
 *   trackingId     - Your tracking ID
 */
async function handleFlipkartPostback(req, res, db) {
  // Verify token to prevent spoofing
  const token = req.query.token || req.headers['x-postback-token'];
  if (token !== FLIPKART_CONFIG.postbackToken) {
    console.warn('[FK Postback] Invalid token from', req.ip);
    return res.status(401).send('Unauthorized');
  }

  const {
    orderId, orderAmount, commissionAmount,
    affExtParam1: clickId, affExtParam2: userId,
    status, productName, category
  } = req.query;

  console.log('[FK Postback] Received:', { orderId, orderAmount, commissionAmount, clickId, status });

  // Always ACK first to prevent Flipkart retries
  res.status(200).send('OK');

  if (!orderId) { console.warn('[FK Postback] Missing orderId'); return; }

  try {
    // Idempotency check
    const exists = await db.query(
      'SELECT id FROM flipkart_sales WHERE fk_order_id = ?', [orderId]
    );
    if (exists.length > 0) {
      console.log('[FK Postback] Duplicate, skipping:', orderId);
      return;
    }

    const commission   = parseFloat(commissionAmount) || 0;
    const orderAmt     = parseFloat(orderAmount)      || 0;
    const USER_SHARE   = 0.65;  // Give 65% of commission to user as cashback
    const cashbackAmt  = parseFloat((commission * USER_SHARE).toFixed(2));

    // Map status
    const statusMap = { 'Approved': 'confirmed', 'Pending': 'tracking', 'Cancelled': 'cancelled' };
    const trackStatus = statusMap[status] || 'tracking';

    // Resolve user from clickId or userId param
    let resolvedUserId = userId || null;
    if (!resolvedUserId && clickId) {
      const click = await db.query('SELECT user_id FROM affiliate_clicks WHERE id = ?', [clickId]);
      if (click.length > 0) resolvedUserId = click[0].user_id;
    }

    // Insert sale record
    await db.query(`
      INSERT INTO flipkart_sales
        (fk_order_id, order_amount, commission, cashback_amount, user_id,
         click_id, product_name, category, status, raw_payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [orderId, orderAmt, commission, cashbackAmt, resolvedUserId,
        clickId || null, productName || '', category || '',
        trackStatus, JSON.stringify(req.query)]);

    // Mirror into orders so the sale shows up in the user's Order Tracking
    if (resolvedUserId) {
      try {
        const stores = await db.query(
          `SELECT id FROM stores WHERE affiliate_type = 'flipkart' LIMIT 1`);
        if (stores.length > 0) {
          const oid = `o_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          await db.query(`
            INSERT IGNORE INTO orders
              (id, user_id, store_id, click_id, order_number, order_amount, cashback_amount,
               order_date, source, status, admin_notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'postback', ?, 'Auto-tracked via Flipkart postback', NOW())
          `, [oid, resolvedUserId, stores[0].id, clickId || null, orderId, orderAmt, cashbackAmt,
              new Date().toISOString().slice(0, 10), trackStatus === 'cancelled' ? 'cancelled' : trackStatus]);
        }
      } catch (err) {
        console.error('[FK Postback] Order mirror failed:', err.message);
      }
    }

    // Credit wallet if approved
    if (trackStatus === 'confirmed' && resolvedUserId && cashbackAmt > 0) {
      await db.query(`
        UPDATE users SET wallet = wallet + ?, total_earned = total_earned + ?
        WHERE id = ?
      `, [cashbackAmt, cashbackAmt, resolvedUserId]);

      // Create notification
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type, created_at)
        VALUES (?, 'Flipkart Cashback Confirmed!', ?, 'cashback', NOW())
      `, [resolvedUserId, `₹${cashbackAmt} cashback from Flipkart order #${orderId}`]);

      console.log(`[FK Postback] Credited ₹${cashbackAmt} to user ${resolvedUserId}`);
    } else if (resolvedUserId) {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type, created_at)
        VALUES (?, 'Flipkart Purchase Tracked', ?, 'tracking', NOW())
      `, [resolvedUserId, `Order #${orderId} tracked. ₹${cashbackAmt} cashback pending confirmation.`]);
    }

  } catch (err) {
    console.error('[FK Postback] Processing error:', err.message);
    // Don't re-throw: already sent 200 to Flipkart
  }
}

// ── 3. Flipkart Affiliate API — Product Search ────────────────────────────────
/**
 * Search Flipkart products via their Affiliate API.
 * Useful for auto-populating deals on IndiaOffers.
 *
 * Docs: https://affiliate.flipkart.com/api-docs
 */
async function searchFlipkartProducts(query, limit = 10) {
  const fetch = require('node-fetch');
  const url   = `${FLIPKART_CONFIG.apiBaseUrl}/offers/v1/feed/get?`
    + `type=json&affid=${FLIPKART_CONFIG.affiliateId}&query=${encodeURIComponent(query)}`;

  const res  = await fetch(url, {
    headers: { 'Fk-Affiliate-Id': FLIPKART_CONFIG.affiliateId,
               'Fk-Affiliate-Token': FLIPKART_CONFIG.apiKey }
  });

  if (!res.ok) throw new Error(`Flipkart API ${res.status}`);
  const data = await res.json();

  return (data.products || []).slice(0, limit).map(p => ({
    title      : p.productBaseInfo?.productInfo?.title || '',
    price      : p.productBaseInfo?.productInfo?.flipkartSellingPrice?.amount || 0,
    mrp        : p.productBaseInfo?.productInfo?.maximumRetailPrice?.amount   || 0,
    discount   : p.productBaseInfo?.productInfo?.discountPercentage || 0,
    image      : p.productBaseInfo?.productInfo?.imageUrls?.['400x400'] || '',
    productUrl : p.productBaseInfo?.productInfo?.productUrl || '',
    category   : p.productBaseInfo?.productInfo?.primaryCategories?.[0] || ''
  }));
}

// ── 4. Click tracker (server-side redirect) ──────────────────────────────────
async function handleFlipkartClick(req, res, db, ctx = {}) {
  const { url: rawUrl, uid, deal } = req.query;
  if (!rawUrl) return res.status(400).send('Missing url');

  const clickId  = `fk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const taggedUrl = buildFlipkartAffiliateUrl(rawUrl, clickId, uid);

  try {
    await db.query(`
      INSERT INTO affiliate_clicks (id, user_id, deal_id, store, raw_url, tagged_url, ip_address, user_agent, referrer, clicked_at)
      VALUES (?, ?, ?, 'flipkart', ?, ?, ?, ?, ?, NOW())
    `, [clickId, uid || null, deal || null, rawUrl, taggedUrl,
        ctx.ip || req.ip || '', ctx.userAgent || req.headers['user-agent'] || '', ctx.referrer || '']);
  } catch (err) {
    console.error('[FlipkartTracker] DB insert failed:', err.message);
  }

  // Set click cookie (24h — Flipkart's attribution window). No domain/secure on localhost.
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOpts = ctx.cookieOpts ? ctx.cookieOpts(1) : {
    maxAge: 24 * 60 * 60 * 1000, httpOnly: false, secure: isProd, sameSite: 'Lax',
    ...(isProd ? { domain: '.indiaoffers.in' } : {})
  };
  res.cookie('io_click', clickId, cookieOpts);

  res.redirect(302, taggedUrl);
}

// ── 5. Daily reconciliation — pull report CSV ────────────────────────────────
/**
 * Flipkart provides downloadable CSV reports in the Associates portal.
 * Similar to Amazon, there's no real-time API for historical reports.
 *
 * Schedule this via cron at 07:00 IST daily.
 * Use Playwright to log in and download, or use email-to-CSV if enabled.
 */
function parseFlipkartReport(csvText) {
  const lines  = csvText.trim().split('\n');
  const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const sales  = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
    const row  = {};
    header.forEach((h, idx) => { row[h] = cols[idx] || ''; });

    sales.push({
      date           : row['Date']             || row['Transaction Date'] || '',
      orderId        : row['Order ID']         || row['OrderId']          || '',
      subId1         : row['Sub ID 1']         || row['affExtParam1']     || '', // our clickId
      subId2         : row['Sub ID 2']         || row['affExtParam2']     || '', // our userId
      productName    : row['Product Name']     || '',
      category       : row['Category']         || '',
      saleAmount     : parseFloat(row['Sale Amount'] || row['GMV'] || 0),
      commission     : parseFloat(row['Commission']  || 0),
      status         : row['Status']           || 'Pending'
    });
  }

  return sales.filter(s => s.orderId);
}

module.exports = {
  buildFlipkartAffiliateUrl,
  handleFlipkartPostback,
  handleFlipkartClick,
  searchFlipkartProducts,
  parseFlipkartReport,
  FLIPKART_CONFIG
};
