'use strict';

/** Small public JSON API (search suggestions, savings calculator). */

const router = require('express').Router();
const db = require('../db');
const { savingsStack, activeBankOffers } = require('../services/savings');

router.get('/suggest', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });
  try {
    const rows = await db.query(`
      SELECT slug, title, price FROM deals
      WHERE is_active = 1 AND title LIKE ? ORDER BY clicks DESC LIMIT 6
    `, [`%${q}%`]);
    res.json({ results: rows.map(r => ({ slug: r.slug, title: r.title, price: r.price })) });
  } catch {
    res.json({ results: [] });
  }
});

/** Savings stack for one deal (used by admin preview). */
router.get('/savings/:dealId', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM deals WHERE id = ?', [req.params.dealId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const offers = await activeBankOffers();
    res.json({ stack: savingsStack(rows[0], offers) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1 AS ok');
    res.json({ status: 'ok', driver: db.driver });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

module.exports = router;
