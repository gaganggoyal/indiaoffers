'use strict';

/**
 * Alert engine — when an admin publishes/updates a bank offer that targets a
 * specific bank card, every user who holds that card gets a queued alert row.
 * A background worker (or WhatsApp/email cron) can later read unsent alerts and
 * deliver them; here we just enqueue reliably.
 */

const db = require('../db');

/**
 * Enqueue "sale on your card" alerts for a bank offer.
 * @param {object} offer  saved bank_offers row (must have id, bank_card_id, title)
 * @returns {number} count of alerts created
 */
async function generateCardOfferAlerts(offer) {
  if (!offer || !offer.bank_card_id || !offer.is_active) return 0;

  const cards = await db.query('SELECT name, slug FROM bank_cards WHERE id = ?', [offer.bank_card_id]);
  const card = cards[0];
  if (!card) return 0;

  const holders = await db.query(
    `SELECT uc.user_id FROM user_cards uc
       JOIN users u ON u.id = uc.user_id
      WHERE uc.bank_card_id = ? AND u.is_active = 1`,
    [offer.bank_card_id]
  );
  if (holders.length === 0) return 0;

  const title = `New offer on your ${card.name}`;
  const body  = offer.title + (offer.promo_code ? ` (code ${offer.promo_code})` : '');
  const link  = '/bank-offers?bank=' + encodeURIComponent(offer.bank);

  let created = 0;
  for (const h of holders) {
    // one alert per user per offer — skip if already queued
    const dup = await db.query(
      'SELECT id FROM alerts WHERE user_id = ? AND bank_offer_id = ?',
      [h.user_id, offer.id]
    );
    if (dup.length) continue;
    await db.query(
      `INSERT INTO alerts (user_id, kind, title, body, link_url, bank_offer_id, is_sent, is_read)
       VALUES (?, 'card_offer', ?, ?, ?, ?, 0, 0)`,
      [h.user_id, title, body, link, offer.id]
    );
    created++;
  }
  return created;
}

module.exports = { generateCardOfferAlerts };
