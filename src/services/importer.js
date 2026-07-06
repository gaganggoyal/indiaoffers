'use strict';

/**
 * CSV bulk importer — lets an admin create/update stores, deals, bank offers,
 * coupons and bank cards from an uploaded spreadsheet.
 *
 * Design:
 *  • Header names are normalised (trim → lower → spaces to "_"), so "Deal Price"
 *    and "deal_price" are the same column. Each field accepts a few aliases.
 *  • UPSERT: a row updates an existing record when it matches on `id` (if given)
 *    or the entity's natural key (slug / store+code); otherwise it inserts.
 *  • PARTIAL updates are safe — only columns present in the sheet are written, so
 *    a sheet with just `slug,price` updates the price and leaves everything else.
 *    An empty cell in a present column clears that field (set to blank/null).
 *  • Required columns are enforced only when INSERTING a new row.
 *
 * Returns a per-file summary: { total, inserted, updated, errors:[{line,error}] }.
 */

const { parse } = require('csv-parse/sync');
const db = require('../db');
const { uid, slugify, nowSql } = db;

// ── value coercers ──────────────────────────────────────────────────────────
const str  = v => { const s = (v == null ? '' : String(v)).trim(); return s === '' ? null : s; };
const bool = (v, def = 1) => {
  const s = v == null ? '' : String(v).trim();
  if (s === '') return def;
  return /^(1|true|yes|y|on|live|active)$/i.test(s) ? 1 : 0;
};
const num = v => {
  const s = (v == null ? '' : String(v)).replace(/[₹,\s]/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
// newline- or pipe-separated cell → JSON array string (for how_to / benefits …)
const pipeJson = v => {
  const s = str(v);
  if (!s) return null;
  return JSON.stringify(s.split(/[\n|]+/).map(x => x.trim()).filter(Boolean));
};
// first non-empty value among aliases (already-normalised keys)
const g = (rec, ...keys) => {
  for (const k of keys) { const val = rec[k]; if (val != null && String(val).trim() !== '') return String(val).trim(); }
  return '';
};

// ── store reference resolution (name / slug / id, case-insensitive) ──────────
async function loadStoreMap() {
  const rows = await db.query('SELECT id, slug, name FROM stores');
  const byId = {}, bySlug = {}, byName = {};
  for (const s of rows) { byId[s.id] = s.id; bySlug[String(s.slug).toLowerCase()] = s.id; byName[String(s.name).toLowerCase()] = s.id; }
  return { byId, bySlug, byName };
}
function resolveStoreId(ref, storeMap, { required = false } = {}) {
  const r = String(ref || '').trim();
  if (!r || /^all( stores)?$/i.test(r)) { if (required) throw new Error('store is required'); return null; }
  const key = r.toLowerCase();
  const id = storeMap.byId[r] || storeMap.bySlug[key] || storeMap.byName[key];
  if (!id) throw new Error(`store not found: "${r}" — add the store first, or use its exact name / slug / id`);
  return id;
}

// A small helper bound to one row: set(col, [aliases], transform) writes a column
// only when the sheet actually has one of those aliases as a header.
function setter(rec, headerSet, cols) {
  return (col, aliases, transform) => {
    const key = aliases.find(a => headerSet.has(a));
    if (key === undefined) return;                 // column absent → leave untouched
    cols[col] = transform ? transform(rec[key]) : str(rec[key]);
  };
}

// ── entity definitions ──────────────────────────────────────────────────────
const ENTITIES = {
  stores: {
    label: 'Stores', table: 'stores', idPrefix: 'st',
    requiredForInsert: ['name', 'slug'],
    template: ['name', 'category', 'website_url', 'affiliate_url', 'affiliate_type', 'affiliate_params', 'cashback_text', 'color', 'logo_url', 'description', 'is_active'],
    sample: ['Ajio', 'fashion', 'https://www.ajio.com', 'https://www.ajio.com', 'none', 'utm_source=indiaoffers', 'Upto 6% IO rewards', '#2f6df6', '', 'Fashion & lifestyle store', '1'],
    build(rec, hs, ctx) {
      const cols = {}; const set = setter(rec, hs, cols);
      if (hs.has('name') || hs.has('slug')) cols.slug = slugify(g(rec, 'slug') || g(rec, 'name'));
      set('name', ['name'], str);
      set('color', ['color', 'brand_color'], v => str(v) || '#4f46e5');
      set('logo_url', ['logo_url', 'logo', 'logo_link'], str);
      set('category', ['category'], v => str(v) || '');
      set('description', ['description', 'desc'], v => str(v) || '');
      set('website_url', ['website_url', 'website', 'url'], str);
      set('affiliate_url', ['affiliate_url'], str);
      set('affiliate_type', ['affiliate_type'], v => { const t = (str(v) || 'none').toLowerCase(); return ['none', 'amazon', 'flipkart'].includes(t) ? t : 'none'; });
      set('affiliate_params', ['affiliate_params', 'affiliate_tag', 'tag'], v => (str(v) || '').replace(/^[?&]+/, '') || null);
      set('cashback_text', ['cashback_text', 'cashback'], str);
      set('is_active', ['is_active', 'active', 'live'], v => bool(v, 1));
      if (g(rec, 'id')) cols.id = g(rec, 'id');
      return { cols, finderField: 'slug', finderVal: cols.slug };
    }
  },

  deals: {
    label: 'Deals', table: 'deals', idPrefix: 'dl', needsStores: true,
    requiredForInsert: ['title', 'slug', 'store_id', 'deal_url'],
    template: ['title', 'store', 'category', 'deal_url', 'image_url', 'mrp', 'price', 'true_price', 'savings_note', 'coupon_code', 'badge', 'cashback_text', 'how_to', 'is_trending', 'is_active', 'expiry_date'],
    sample: ['Sony WH-1000XM5 Headphones', 'Amazon', 'electronics', 'https://www.amazon.in/dp/B09XS7JWHH', '', '34990', '24990', '', '', 'SAVE10', 'LOOT', 'Upto 4% IO rewards', 'Add to cart|Apply coupon SAVE10|Pay with ICICI card', '1', '1', '2026-12-31'],
    build(rec, hs, ctx) {
      const cols = {}; const set = setter(rec, hs, cols);
      if (hs.has('title') || hs.has('slug') || hs.has('name')) cols.slug = slugify(g(rec, 'slug') || g(rec, 'title', 'name'));
      set('title', ['title', 'name'], str);
      if (hs.has('store') || hs.has('store_id') || hs.has('store_name') || hs.has('store_slug'))
        cols.store_id = resolveStoreId(g(rec, 'store', 'store_id', 'store_name', 'store_slug'), ctx.stores, { required: true });
      set('description', ['description', 'desc'], v => str(v) || '');
      set('category', ['category'], v => str(v) || '');
      set('image_url', ['image_url', 'image'], str);
      set('mrp', ['mrp'], num);
      set('price', ['price', 'deal_price'], num);
      set('true_price', ['true_price'], num);
      set('savings_note', ['savings_note'], str);
      set('coupon_code', ['coupon_code', 'coupon'], str);
      set('deal_url', ['deal_url', 'url', 'link'], str);
      set('how_to', ['how_to', 'steps'], pipeJson);
      set('badge', ['badge'], str);
      set('cashback_text', ['cashback_text', 'cashback'], str);
      set('is_trending', ['is_trending', 'trending'], v => bool(v, 0));
      set('is_active', ['is_active', 'active', 'live'], v => bool(v, 1));
      set('expiry_date', ['expiry_date', 'expiry'], str);
      cols.updated_at = nowSql();
      if (g(rec, 'id')) cols.id = g(rec, 'id');
      return { cols, finderField: 'slug', finderVal: cols.slug };
    }
  },

  bank_offers: {
    label: 'Bank Offers', table: 'bank_offers', idPrefix: 'bo', needsStores: true,
    requiredForInsert: ['bank', 'title', 'discount_value'],
    template: ['bank', 'instrument', 'title', 'description', 'discount_type', 'discount_value', 'max_discount', 'min_order', 'store', 'promo_code', 'valid_from', 'valid_till', 'source_url', 'is_active', 'id'],
    sample: ['HDFC Bank', 'credit', '10% instant discount on HDFC Credit Cards', '', 'percent', '10', '1500', '3000', '', 'HDFC10', '2026-07-01', '2026-07-31', 'https://…', '1', ''],
    build(rec, hs, ctx) {
      const cols = {}; const set = setter(rec, hs, cols);
      set('bank', ['bank'], str);
      set('instrument', ['instrument'], v => { const t = (str(v) || 'credit').toLowerCase(); return ['credit', 'debit', 'upi', 'netbanking', 'emi', 'any'].includes(t) ? t : 'credit'; });
      set('title', ['title'], str);
      set('description', ['description', 'desc'], v => str(v) || '');
      set('discount_type', ['discount_type', 'type'], v => { const t = (str(v) || 'percent').toLowerCase(); return t === 'flat' ? 'flat' : 'percent'; });
      set('discount_value', ['discount_value', 'value', 'discount'], v => num(v) || 0);
      set('max_discount', ['max_discount', 'cap'], num);
      set('min_order', ['min_order', 'min'], v => num(v) || 0);
      if (hs.has('store') || hs.has('store_id') || hs.has('store_name') || hs.has('store_slug'))
        cols.store_id = resolveStoreId(g(rec, 'store', 'store_id', 'store_name', 'store_slug'), ctx.stores, { required: false });
      set('promo_code', ['promo_code', 'promo', 'code'], str);
      set('valid_from', ['valid_from'], str);
      set('valid_till', ['valid_till', 'valid_to'], str);
      set('source_url', ['source_url', 'source'], str);
      set('is_active', ['is_active', 'active', 'live'], v => bool(v, 1));
      if (g(rec, 'id')) cols.id = g(rec, 'id');
      return { cols, finderField: null, finderVal: null };  // no natural key → id-only or insert
    }
  },

  coupons: {
    label: 'Coupons', table: 'coupons', idPrefix: 'cp', needsStores: true,
    requiredForInsert: ['store_id', 'code', 'title'],
    template: ['store', 'code', 'title', 'description', 'discount_text', 'min_order', 'expiry_date', 'is_verified', 'is_active', 'id'],
    sample: ['Myntra', 'MYNTRA200', 'Flat ₹200 off above ₹999', '', '₹200 OFF above ₹999', '999', '2026-08-15', '1', '1', ''],
    build(rec, hs, ctx) {
      const cols = {}; const set = setter(rec, hs, cols);
      if (hs.has('store') || hs.has('store_id') || hs.has('store_name') || hs.has('store_slug'))
        cols.store_id = resolveStoreId(g(rec, 'store', 'store_id', 'store_name', 'store_slug'), ctx.stores, { required: true });
      set('code', ['code', 'coupon_code'], v => (str(v) || '').toUpperCase() || null);
      set('title', ['title'], str);
      set('description', ['description', 'desc'], v => str(v) || '');
      set('discount_text', ['discount_text', 'discount'], v => str(v) || '');
      set('min_order', ['min_order', 'min'], v => num(v) || 0);
      set('expiry_date', ['expiry_date', 'expiry'], str);
      set('is_verified', ['is_verified', 'verified'], v => bool(v, 0));
      set('is_active', ['is_active', 'active', 'live'], v => bool(v, 1));
      if (g(rec, 'id')) cols.id = g(rec, 'id');
      // natural key: store_id + code
      const finder2 = (cols.store_id && cols.code) ? { a: 'store_id', av: cols.store_id, b: 'code', bv: cols.code } : null;
      return { cols, finderField: null, finderVal: null, finder2 };
    }
  },

  bank_cards: {
    label: 'Bank Cards', table: 'bank_cards', idPrefix: 'bc',
    requiredForInsert: ['name', 'slug', 'bank'],
    template: ['name', 'bank', 'network', 'card_type', 'image_url', 'tagline', 'joining_fee', 'annual_fee', 'best_for', 'benefits', 'how_to_apply', 'eligibility', 'apply_url', 'video_url', 'is_featured', 'sort_order', 'is_active'],
    sample: ['HDFC Millennia Credit Card', 'HDFC Bank', 'Visa', 'credit', '', 'Cashback on everything', '₹1,000 + GST', '₹1,000 + GST', 'Online shopping & dining', '5% cashback on Amazon|1% on all spends', 'Apply online|Complete KYC', 'Salaried, income ₹35k+/mo', 'https://…', '', '0', '10', '1'],
    build(rec, hs, ctx) {
      const cols = {}; const set = setter(rec, hs, cols);
      if (hs.has('name') || hs.has('slug')) cols.slug = slugify(g(rec, 'slug') || g(rec, 'name'));
      set('name', ['name'], str);
      set('bank', ['bank'], str);
      set('network', ['network'], str);
      set('card_type', ['card_type', 'type'], v => { const t = (str(v) || 'credit').toLowerCase(); return t === 'debit' ? 'debit' : 'credit'; });
      set('image_url', ['image_url', 'image'], str);
      set('tagline', ['tagline'], str);
      set('joining_fee', ['joining_fee'], str);
      set('annual_fee', ['annual_fee'], str);
      set('best_for', ['best_for'], str);
      set('benefits', ['benefits'], pipeJson);
      set('how_to_apply', ['how_to_apply', 'how_to'], pipeJson);
      set('eligibility', ['eligibility'], str);
      set('apply_url', ['apply_url', 'apply'], str);
      set('video_url', ['video_url', 'video'], str);
      set('is_featured', ['is_featured', 'featured'], v => bool(v, 0));
      set('sort_order', ['sort_order', 'sort'], v => num(v) || 0);
      set('is_active', ['is_active', 'active', 'live'], v => bool(v, 1));
      if (g(rec, 'id')) cols.id = g(rec, 'id');
      return { cols, finderField: 'slug', finderVal: cols.slug };
    }
  }
};

// ── upsert primitives ───────────────────────────────────────────────────────
async function locate(table, built) {
  if (built.cols.id) {
    const r = await db.query(`SELECT id FROM ${table} WHERE id = ?`, [built.cols.id]);
    if (r.length) return r[0].id;
  }
  if (built.finderField && built.finderVal != null && built.finderVal !== '') {
    const r = await db.query(`SELECT id FROM ${table} WHERE ${built.finderField} = ?`, [built.finderVal]);
    if (r.length) return r[0].id;
  }
  if (built.finder2) {
    const r = await db.query(`SELECT id FROM ${table} WHERE ${built.finder2.a} = ? AND ${built.finder2.b} = ?`, [built.finder2.av, built.finder2.bv]);
    if (r.length) return r[0].id;
  }
  return null;
}

async function applyUpsert(cfg, built, existingId) {
  const cols = { ...built.cols };
  if (existingId) {
    delete cols.id;
    const names = Object.keys(cols);
    if (names.length) {
      await db.query(`UPDATE ${cfg.table} SET ${names.map(n => `${n} = ?`).join(', ')} WHERE id = ?`, [...names.map(n => cols[n]), existingId]);
    }
    return 'updated';
  }
  cols.id = cols.id || uid(cfg.idPrefix);
  const names = Object.keys(cols);
  await db.query(`INSERT INTO ${cfg.table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`, names.map(n => cols[n]));
  return 'inserted';
}

// ── public API ──────────────────────────────────────────────────────────────
function entityList() {
  return Object.entries(ENTITIES).map(([key, c]) => ({ key, label: c.label, columns: c.template }));
}

/** CSV text (with a header row) for one entity's downloadable template. */
function templateCsv(entityKey) {
  const cfg = ENTITIES[entityKey];
  if (!cfg) throw new Error('Unknown import type');
  const quote = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  return cfg.template.map(quote).join(',') + '\n' + (cfg.sample || []).map(quote).join(',') + '\n';
}

/** Parse and upsert an uploaded CSV for one entity. */
async function importCsv(entityKey, csvText) {
  const cfg = ENTITIES[entityKey];
  if (!cfg) throw new Error('Unknown import type: ' + entityKey);

  let records;
  try {
    records = parse(csvText, {
      columns: header => header.map(h => h.trim().toLowerCase().replace(/\s+/g, '_')),
      skip_empty_lines: true, trim: true, bom: true, relax_column_count: true
    });
  } catch (e) { throw new Error('Could not read the CSV — ' + e.message); }

  const headerSet = new Set(records.length ? Object.keys(records[0]) : []);
  const ctx = {};
  if (cfg.needsStores) ctx.stores = await loadStoreMap();

  const res = { entity: entityKey, label: cfg.label, total: records.length, inserted: 0, updated: 0, errors: [] };
  let line = 1;                                    // line 1 is the header row
  for (const rec of records) {
    line++;
    try {
      const built = cfg.build(rec, headerSet, ctx);
      const existingId = await locate(cfg.table, built);
      if (!existingId) {
        for (const rc of cfg.requiredForInsert) {
          const v = built.cols[rc];
          if (v === undefined || v === null || v === '')
            throw new Error(`can't create a new row without "${rc.replace('store_id', 'store')}"`);
        }
      }
      const action = await applyUpsert(cfg, built, existingId);
      res[action]++;
    } catch (e) {
      res.errors.push({ line, error: e.message });
    }
  }
  return res;
}

module.exports = { entityList, templateCsv, importCsv, ENTITIES };
