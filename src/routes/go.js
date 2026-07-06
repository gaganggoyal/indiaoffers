'use strict';

/** Outbound redirects: /go/d/:id (deal) and /go/s/:id (store). */

const router = require('express').Router();
const db = require('../db');
const { tagAffiliateUrl, recordClick } = require('../services/tracking');

router.get('/d/:id', async (req, res) => {
  try {
    const rows = await db.query(`
      SELECT d.id, d.store_id, d.deal_url, s.affiliate_type, s.affiliate_url, s.affiliate_params
      FROM deals d JOIN stores s ON s.id = d.store_id
      WHERE d.id = ? AND d.is_active = 1
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).send('Deal not found');

    const deal = rows[0];
    const clickId = `c${Date.now().toString(36)}`;
    const target = tagAffiliateUrl(deal.deal_url || deal.affiliate_url, deal, clickId);
    await recordClick({ dealId: deal.id, storeId: deal.store_id, targetUrl: target, req });
    res.redirect(302, target);
  } catch (err) {
    console.error('[Go] deal redirect failed:', err.message);
    res.status(500).send('Redirect failed');
  }
});

router.get('/s/:id', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM stores WHERE id = ? AND is_active = 1', [req.params.id]);
    if (rows.length === 0) return res.status(404).send('Store not found');

    const store = rows[0];
    const clickId = `c${Date.now().toString(36)}`;
    const target = tagAffiliateUrl(store.affiliate_url || store.website_url, store, clickId);
    await recordClick({ storeId: store.id, targetUrl: target, req });
    res.redirect(302, target);
  } catch (err) {
    console.error('[Go] store redirect failed:', err.message);
    res.status(500).send('Redirect failed');
  }
});

module.exports = router;
