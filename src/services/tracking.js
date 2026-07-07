'use strict';

/**
 * Outbound click tracking + affiliate URL tagging.
 * /go/d/:id → logs the click, tags the merchant URL, 302-redirects.
 */

const db = require('../db');
const config = require('../config');

// Any brace token containing "click" is a click-id placeholder, so all of
// {click}, {clickid} and the network's own {your-click-id} resolve to the id.
// Put this on the param you use to correlate back to your own clicks log (p1).
const CLICK_TOKEN = /\{[^}]*click[^}]*\}/gi;
// {user}/{username} (and legacy {your-sub-aff-id}) resolve to the logged-in
// user's username, for per-user conversion attribution (e.g. p2={username}).
const USER_TOKEN = /\{(?:user(?:name)?)\}|\{[^}]*sub[^}]*aff[^}]*\}/gi;

// Replace the placeholder tokens a network hands us with our real values.
// username falls back to the click id for logged-out visitors, so the value is
// still uniquely traceable. `source=indiaoffers` etc. are typed literally.
function resolveTokens(str, clickId, username) {
  return String(str)
    .replace(CLICK_TOKEN, clickId || '')
    .replace(USER_TOKEN, username || clickId || '');
}

/**
 * Merge an admin-managed query-string fragment onto a URL. The fragment lives
 * on the store (`affiliate_params`), e.g. "tag=indiaoffers-21&subid={click}".
 * Click-id tokens (`{click}`, `{clickid}`, `{your-click-id}`) are replaced with
 * the current click id, so admins can wire per-click sub-tracking without code
 * changes. Params here are authoritative — they overwrite any same-named param
 * already on the URL.
 */
function applyParams(url, paramStr, clickId, username) {
  const resolved = resolveTokens(paramStr, clickId, username);
  for (const pair of resolved.replace(/^[?&]+/, '').split('&')) {
    if (!pair) continue;
    const eq  = pair.indexOf('=');
    const key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq)).trim();
    const val = eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
    if (key) url.searchParams.set(key, val);
  }
}

/**
 * Build a network tracking link: the store's `affiliate_prefix` with the
 * outbound merchant URL attached. Many affiliate networks (vCommission,
 * Cuelinks, INRDeals…) hand you a link like
 *   https://track.vcommission.com/click?campaign_id=13410&pub_id=100668&p1={your-click-id}&url=
 * where the destination is appended at the end. Click-id tokens (e.g.
 * `p1={your-click-id}`) are replaced with the click id. The destination URL is
 * always percent-encoded before being attached — as a `{url}` token if present,
 * otherwise appended to the end — so e.g. https://www.ajio.com/ becomes
 * https%3A%2F%2Fwww.ajio.com%2F on the query string.
 */
function buildPrefixedUrl(prefix, dest, clickId, username) {
  const p = resolveTokens(String(prefix).trim(), clickId, username);
  const encoded = encodeURIComponent(dest || '');
  if (/\{url\}/i.test(p)) return p.replace(/\{url\}/gi, encoded);
  return p + encoded;
}

/**
 * Tag an outbound URL for affiliate commission.
 * @param rawUrl  merchant/deal URL
 * @param store   store row (uses .affiliate_prefix, else .affiliate_type +
 *                .affiliate_params); a bare affiliate_type string is still
 *                accepted for backward compat.
 * @param clickId  internal click id, exposed to admin params via {click}
 * @param username logged-in user's username, filled into {username}/{user} (e.g.
 *                 p2={username}) for per-user conversion attribution; falls back
 *                 to the click id for logged-out visitors
 */
function tagAffiliateUrl(rawUrl, store, clickId, username) {
  const isObj = store && typeof store === 'object';
  const affiliateType = isObj ? store.affiliate_type   : store;
  const params        = isObj ? store.affiliate_params : null;
  const prefix        = isObj ? store.affiliate_prefix : null;
  // A network tracking prefix takes precedence — the network owns the tagging.
  if (prefix && String(prefix).trim()) return buildPrefixedUrl(prefix, rawUrl, clickId, username);
  try {
    const url = new URL(rawUrl);
    if (params && params.trim()) {
      // Admin-managed params take full control of tagging for this store.
      applyParams(url, params, clickId, username);
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
