'use strict';

/**
 * Outbound click tracking + affiliate URL tagging.
 * /go/d/:id → logs the click, tags the merchant URL, 302-redirects.
 */

const db = require('../db');
const config = require('../config');

function tagAffiliateUrl(rawUrl, affiliateType, clickId) {
  try {
    const url = new URL(rawUrl);
    if (affiliateType === 'amazon' && /amazon\.in|amzn\.to/.test(url.hostname)) {
      url.searchParams.delete('tag');
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
