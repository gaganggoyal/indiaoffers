'use strict';

/**
 * Savings engine — the heart of IndiaOffers.
 *
 * Given a deal and the live bank_offers table, computes every applicable
 * payment option and the resulting "true price":
 *
 *   MRP ₹4,999
 *   Deal price               ₹2,499   (50% off)
 *   + HDFC Credit 10% (cap ₹500)  −₹250  → ₹2,249  ← best way to pay
 *   + Axis UPI flat ₹100          −₹100  → ₹2,399
 *
 * An offer applies when: it's active, within its validity window, its
 * min_order ≤ deal price, and it's either store-wide (store_id = NULL)
 * or pinned to the deal's store.
 */

const db = require('../db');

const INSTRUMENT_LABELS = {
  credit: 'Credit Card', debit: 'Debit Card', upi: 'UPI',
  netbanking: 'Net Banking', emi: 'EMI', any: 'Cards & UPI'
};

function offerApplies(offer, dealPrice, storeId, todayStr) {
  if (!offer.is_active) return false;
  if (offer.store_id && offer.store_id !== storeId) return false;
  if (dealPrice != null && +offer.min_order > dealPrice) return false;
  if (offer.valid_from && todayStr < String(offer.valid_from).slice(0, 10)) return false;
  if (offer.valid_till && todayStr > String(offer.valid_till).slice(0, 10)) return false;
  return true;
}

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

function computeDiscount(offer, price) {
  if (price == null) return 0;
  let d = offer.discount_type === 'flat'
    ? +offer.discount_value
    : price * (+offer.discount_value / 100);
  if (offer.max_discount != null) d = Math.min(d, +offer.max_discount);
  return Math.max(0, Math.round(d));
}

/**
 * Compute the full savings stack for one deal.
 * @param {object} deal        deal row (needs price, mrp, store_id)
 * @param {Array}  bankOffers  active bank_offers rows (pre-fetched)
 * @returns {object} { productDiscount, discountPct, payOptions[], best, maxSaving }
 */
function savingsStack(deal, bankOffers) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const price = deal.price != null ? +deal.price : null;
  const mrp   = deal.mrp   != null ? +deal.mrp   : null;

  const productDiscount = (mrp != null && price != null && mrp > price) ? mrp - price : 0;
  const discountPct = productDiscount > 0 ? Math.round((productDiscount / mrp) * 100) : null;

  // Manual pay-option rows typed by the admin on the deal itself. When present,
  // they fully replace the auto-matched bank offers for this deal.
  const manualRows = parseManualRows(deal.savings_rows);

  const payOptions = (manualRows.length
    ? manualRows.map((r, i) => ({
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
    : bankOffers
        .filter(o => offerApplies(o, price, deal.store_id, todayStr))
        .map(o => {
          const saving = computeDiscount(o, price);
          return {
            id: o.id,
            bank: o.bank,
            instrument: o.instrument,
            instrumentLabel: INSTRUMENT_LABELS[o.instrument] || o.instrument,
            title: o.title,
            promoCode: o.promo_code || null,
            saving,
            effectivePrice: price != null ? price - saving : null,
            label: o.discount_type === 'flat'
              ? `Flat ₹${(+o.discount_value).toLocaleString('en-IN')} off`
              : `${+o.discount_value}% off${o.max_discount != null ? ` (max ₹${(+o.max_discount).toLocaleString('en-IN')})` : ''}`,
            minOrder: +o.min_order || 0,
            validTill: o.valid_till ? String(o.valid_till).slice(0, 10) : null
          };
        }))
    .filter(o => o.saving > 0)
    .sort((a, b) => b.saving - a.saving);

  const best = payOptions[0] || null;

  // Admin overrides (per deal). A manual true_price wins over the computed one;
  // savings_note replaces the auto explanation. Blank/null → fully auto.
  const override = deal.true_price != null && deal.true_price !== '' ? +deal.true_price : null;
  const truePrice = override != null ? override
                  : (best && price != null ? best.effectivePrice : price);
  const autoMaxSaving = productDiscount + (best ? best.saving : 0);
  const maxSaving = override != null && mrp != null ? Math.max(0, mrp - override) : autoMaxSaving;

  return {
    price, mrp, productDiscount, discountPct,
    payOptions, best,
    truePrice,
    maxSaving,
    isOverride: override != null,
    isManual: manualRows.length > 0,
    savingsNote: deal.savings_note || null
  };
}

async function activeBankOffers() {
  return db.query('SELECT * FROM bank_offers WHERE is_active = 1');
}

/** Attach a lightweight stack (best offer only) to a list of deals — for cards. */
function decorateDeals(deals, bankOffers) {
  return deals.map(d => {
    const stack = savingsStack(d, bankOffers);
    return { ...d, stack };
  });
}

module.exports = { savingsStack, activeBankOffers, decorateDeals, INSTRUMENT_LABELS };
