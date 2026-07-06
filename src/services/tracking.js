'use strict';

/**
 * Outbound click tracking + affiliate URL tagging.
 * /go/d/:id → logs the click, tags the merchant URL, 302-redirects.
 */

const db = require('../db');
const config = require('../config');

/**
 * Merge an admin-managed query-string fragment onto a URL. The fragment lives
 * on the store (`affiliate_params`), e.g. "tag=indiaoffers-21&subid={click}".
 * `{click}` / `{clickid}` tokens are replaced with the current click id, so
 * admins can wire per-click sub-tracking without code changes. Params here are
 * authoritative — they overwrite any same-named param already on the URL.
 */
function applyParams(url, paramStr, clickId) {
  const resolved = String(paramStr).replace(/\{click(?:id)?\}/gi, clickId || '');
  for (const pair of resolved.replace(/^[?&]+/, '').split('&')) {
    if (!pair) continue;
    const eq  = pair.indexOf('=');
    const key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq)).trim();
    const val = eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
    if (key) url.searchParams.set(key, val);
  }
}

/**
 * Tag an outbound URL for affiliate commission.
 * @param rawUrl  merchant/deal URL
 * @param store   store row (uses .affiliate_type + .affiliate_params); a bare
 *                affiliate_type string is still accepted for backward compat.
 * @param clickId internal click id, exposed to admin params via {click}
 */
function tagAffiliateUrl(rawUrl, store, clickId) {
  const isObj = store && typeof store === 'object';
  const affiliateType = isObj ? store.affiliate_type   : store;
  const params        = isObj ? store.affiliate_params : null;
  try {
    const url = new URL(rawUrl);
    if (params && params.trim()) {
      // Admin-managed params take full control of tagging for this store.
      applyParams(url, params, clickId);
    } else if (affiliateType === 'amazon' && /amazon\.in|amzn\.to/.test(url.hostname)) {
      url.searchParams.set('tag', config.affiliate.amazonTag);
      if (clickId) url.searchParams.set('io_click', clickId);
    } else if (affiliateType === 'flipkart' && /flipkart\.com|fkrt\.it/.test(url.hostname)) {
      url.searchParams.set('affid', config.affiliate.flipkartAffid);
      if (clickId) url.searchParams.set('affExtParam1', clickId);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

async function recordClick({ dealId, storeId, targetUrl, req }) {
  try {
    await db.query(`
      INSERT INTO clicks (deal_id, store_id, target_url, ip, user_agent, referrer, clicked_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [dealId || null, storeId || null, targetUrl,
        req.ip || '', req.headers['user-agent'] || '', req.headers.referer || '']);
    if (dealId) {
      await db.query('UPDATE deals SET clicks = clicks + 1 WHERE id = ?', [dealId]);
    }
  } catch (err) {
    console.error('[Tracking] click log failed:', err.message);
  }
}

module.exports = { tagAffiliateUrl, recordClick };
