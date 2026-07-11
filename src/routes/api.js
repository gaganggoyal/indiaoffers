'use strict';

/** Small public JSON API (search suggestions, savings calculator). */

const router = require('express').Router();
const db = require('../db');
const { savingsStack, activeBankOffers } = require('../services/savings');

router.get('/suggest', async (req, res) => {
  const q = (req.query.q || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (q.length < 2) return res.json({ stores: [], deals: [], cards: [], guides: [] });
  try {
    // Tokenized like the /search page: every word must match.
    const tokens = q.split(' ').slice(0, 6);
    const and = expr => tokens.map(() => expr).join(' AND ');
    const lp = n => tokens.flatMap(t => Array(n).fill(`%${t}%`));

    const [stores, deals, cards, guides] = await Promise.all([
      db.query(`SELECT slug, name, color, logo_url, website_url FROM stores
                WHERE is_active = 1 AND ${and('(name LIKE ? OR slug LIKE ?)')} ORDER BY name ASC LIMIT 4`, lp(2)),
      db.query(`SELECT slug, title, price FROM deals
                WHERE is_active = 1 AND ${and('(title LIKE ? OR description LIKE ?)')}
                ORDER BY CASE WHEN ${and('title LIKE ?')} THEN 0 ELSE 1 END, clicks DESC, posted_at DESC LIMIT 6`,
                [...lp(2), ...lp(1)]),
      db.query(`SELECT slug, name, bank FROM bank_cards
                WHERE is_active = 1 AND ${and('(name LIKE ? OR bank LIKE ?)')}
                ORDER BY is_featured DESC, sort_order ASC LIMIT 3`, lp(2)),
      db.query(`SELECT slug, title FROM guides
                WHERE is_active = 1 AND ${and('(title LIKE ? OR subtitle LIKE ?)')}
                ORDER BY updated_at DESC LIMIT 3`, lp(2))
    ]);

    res.json({
      stores: stores.map(s => {
        const domain = ((s.website_url || '').match(/^https?:\/\/([^\/]+)/) || [])[1];
        const icon = s.logo_url || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null);
        return { slug: s.slug, name: s.name, color: s.color, icon };
      }),
      deals: deals.map(d => ({ slug: d.slug, title: d.title, price: d.price })),
      cards: cards.map(c => ({ slug: c.slug, name: c.name, bank: c.bank })),
      guides: guides.map(g => ({ slug: g.slug, title: g.title }))
    });
  } catch {
    res.json({ stores: [], deals: [], cards: [], guides: [] });
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
