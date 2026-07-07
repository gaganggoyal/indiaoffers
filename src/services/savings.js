'use strict';

/**
 * Savings helper.
 *
 * A deal shows its plain price, MRP and discount % by default. Any extra
 * "pay with X card / coupon" savings are OPT-IN per deal — the admin types them
 * on the deal (savings_rows / true_price / savings_note). We deliberately do NOT
 * auto-match the bank_offers table onto deals anymore: those computed "best way
 * to pay / true price" numbers were often wrong and painful to keep current.
 *
 * `hasSavings` is true only when the admin has added something to show.
 */

const db = require('../db');

const INSTRUMENT_LABELS = {
  credit: 'Credit Card', debit: 'Debit Card', upi: 'UPI',
  netbanking: 'Net Banking', emi: 'EMI', any: 'Cards & UPI'
};

/** Parse the deal's manual savings rows (JSON) into clean {bank,label,saving,promo} rows. */
function parseManualRows(raw) {
  if (!raw) return [];
  let arr;
  try { arr = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr
    .map(r => ({
      bank: String(r.bank || '').trim(),
      label: String(r.label || '').trim(),
      saving: Math.max(0, Math.round(+r.saving || 0)),
      promo: String(r.promo || '').trim() || null
    }))
    .filter(r => r.bank || r.label || r.saving > 0);
}

/**
 * Build the (mostly manual) savings view for one deal.
 * @param {object} deal  deal row (needs price, mrp; optional savings_rows/true_price/savings_note)
 * @returns {object} { price, mrp, productDiscount, discountPct, payOptions[], best, truePrice, hasSavings, … }
 */
function savingsStack(deal) {
  const price = deal.price != null ? +deal.price : null;
  const mrp   = deal.mrp   != null ? +deal.mrp   : null;

  const productDiscount = (mrp != null && price != null && mrp > price) ? mrp - price : 0;
  const discountPct = productDiscount > 0 ? Math.round((productDiscount / mrp) * 100) : null;

  // Pay-option rows are typed by the admin on the deal itself. Nothing is
  // auto-matched from the bank_offers table — a deal only shows a savings
  // breakdown when the admin explicitly adds one.
  const manualRows = parseManualRows(deal.savings_rows);

  const payOptions = manualRows
    .map((r, i) => ({
      id: 'm' + i,
      bank: r.bank,
      instrument: null,
      instrumentLabel: '',
      title: r.label,
      promoCode: r.promo || null,
      saving: r.saving,
      effectivePrice: price != null ? Math.max(0, price - r.saving) : null,
      label: r.label,
      minOrder: 0,
      validTill: null
    }))
    .filter(o => o.saving > 0)
    .sort((a, b) => b.saving - a.saving);

  const best = payOptions[0] || null;

  // Optional per-deal admin overrides.
  const override = deal.true_price != null && deal.true_price !== '' ? +deal.true_price : null;
  const truePrice = override != null ? override
                  : (best && price != null ? best.effectivePrice : price);
  const autoMaxSaving = productDiscount + (best ? best.saving : 0);
  const maxSaving = override != null && mrp != null ? Math.max(0, mrp - override) : autoMaxSaving;
  const savingsNote = deal.savings_note || null;

  return {
    price, mrp, productDiscount, discountPct,
    payOptions, best,
    truePrice,
    maxSaving,
    isOverride: override != null,
    isManual: manualRows.length > 0,
    savingsNote,
    // Only true when the admin added a savings breakdown to display.
    hasSavings: payOptions.length > 0 || override != null || !!savingsNote
  };
}

async function activeBankOffers() {
  return db.query('SELECT * FROM bank_offers WHERE is_active = 1');
}

/** Attach the savings view to a list of deals — for cards. */
function decorateDeals(deals) {
  return deals.map(d => ({ ...d, stack: savingsStack(d) }));
}

module.exports = { savingsStack, activeBankOffers, decorateDeals, INSTRUMENT_LABELS };
