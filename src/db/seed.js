'use strict';

/**
 * IndiaOffers.in v2 seeder (idempotent — re-runs leave existing rows alone).
 * Run: npm run db:seed
 * Admin login: admin@indiaoffers.in / admin123 (override with ADMIN_PASSWORD)
 */

const bcrypt = require('bcryptjs');
const { query, driver, uid, slugify, today } = require('./index');

const day = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const img = seed => `https://picsum.photos/seed/${seed}/640/420`;

// ── Stores ────────────────────────────────────────────────────────────────────
const STORES = [
  ['st_amazon',   'Amazon',     '#ff9900', 'shopping',    'https://www.amazon.in',      'amazon',   'Upto 4% IO rewards'],
  ['st_flipkart', 'Flipkart',   '#2874f0', 'shopping',    'https://www.flipkart.com',   'flipkart', 'Upto 5% IO rewards'],
  ['st_myntra',   'Myntra',     '#ff3e6c', 'fashion',     'https://www.myntra.com',     'none',     'Upto 6% IO rewards'],
  ['st_ajio',     'Ajio',       '#1e293b', 'fashion',     'https://www.ajio.com',       'none',     null],
  ['st_nykaa',    'Nykaa',      '#e91e63', 'beauty',      'https://www.nykaa.com',      'none',     null],
  ['st_zomato',   'Zomato',     '#e23744', 'food',        'https://www.zomato.com',     'none',     null],
  ['st_swiggy',   'Swiggy',     '#fc8019', 'food',        'https://www.swiggy.com',     'none',     null],
  ['st_mmt',      'MakeMyTrip', '#0d9488', 'travel',      'https://www.makemytrip.com', 'none',     null],
  ['st_bigbasket','BigBasket',  '#5b9bd5', 'grocery',     'https://www.bigbasket.com',  'none',     null],
  ['st_croma',    'Croma',      '#1976d2', 'electronics', 'https://www.croma.com',      'none',     null],
  ['st_tatacliq', 'Tata CLiQ',  '#7c3aed', 'shopping',    'https://www.tatacliq.com',   'none',     null],
  ['st_dominos',  "Domino's",   '#006491', 'food',        'https://www.dominos.co.in',  'none',     null],
];

// ── Bank / card / UPI offers (the differentiator) ─────────────────────────────
// [id, bank, instrument, title, type, value, maxCap, minOrder, storeId(null=all), promoCode, validDays]
const BANK_OFFERS = [
  ['bo_hdfc_amz',  'HDFC Bank',  'credit', '10% instant discount on Amazon',          'percent', 10, 1500, 5000,  'st_amazon',   null,        9],
  ['bo_icici_fk',  'ICICI Bank', 'credit', '10% off on Flipkart with ICICI cards',    'percent', 10, 1000, 4990,  'st_flipkart', null,        7],
  ['bo_sbi_fk',    'SBI',        'debit',  '5% off on Flipkart with SBI debit cards', 'percent', 5,  750,  2990,  'st_flipkart', null,        7],
  ['bo_axis_myn',  'Axis Bank',  'credit', '₹300 off on Myntra above ₹2,499',         'flat',    300, null, 2499, 'st_myntra',   'AXIS300',   12],
  ['bo_kotak_nyk', 'Kotak Bank', 'credit', '15% off on Nykaa (max ₹400)',             'percent', 15, 400,  1499,  'st_nykaa',    'KOTAK15',   10],
  ['bo_hdfc_croma','HDFC Bank',  'emi',    '₹2,000 off on Croma with HDFC EMI',       'flat',    2000, null, 25000,'st_croma',    null,        20],
  ['bo_icici_mmt', 'ICICI Bank', 'credit', '12% off on MakeMyTrip flights',           'percent', 12, 1800, 4500,  'st_mmt',      'ICICIFLY',  15],
  ['bo_paytm_upi', 'Paytm UPI',  'upi',    'Flat ₹50 cashback via Paytm UPI',         'flat',    50,  null, 299,   null,          null,        30],
  ['bo_gpay_upi',  'Google Pay', 'upi',    '₹75 scratch reward on GPay UPI',          'flat',    75,  null, 499,   null,          null,        30],
  ['bo_amex_all',  'Amex',       'credit', '5% back on weekend spends (max ₹500)',    'percent', 5,  500,  1000,  null,          null,        6],
  ['bo_sbi_zom',   'SBI',        'credit', '20% off on Zomato (max ₹120)',            'percent', 20, 120,  249,   'st_zomato',   'ZOMSBI',    8],
  ['bo_axis_swig', 'Axis Bank',  'credit', '15% off on Swiggy (max ₹150)',            'percent', 15, 150,  399,   'st_swiggy',   'AXISWIG',   8],
];

// ── Deals ─────────────────────────────────────────────────────────────────────
// [id, storeId, title, category, mrp, price, code, badge, trending, expiryDays, path, desc]
const DEALS = [
  ['dl_01', 'st_amazon',   'boAt Airdopes 141 TWS Earbuds (42H Playback)',        'electronics', 4490,  1099,  null,       'LOOT', 1, 2,  '/boat-airdopes-141',
   'Bestselling TWS earbuds with ENx tech, low-latency gaming mode and 42-hour total playback.'],
  ['dl_02', 'st_flipkart', 'Samsung Galaxy M35 5G (8GB/128GB)',                   'electronics', 24999, 16499, null,       'HOT',  1, 3,  '/samsung-galaxy-m35',
   '6000mAh battery, sAMOLED 120Hz display, 4 OS updates promised. Great mid-ranger at this price.'],
  ['dl_03', 'st_myntra',   'PUMA, Nike & adidas Sneakers — Min 55% OFF',          'fashion',     7999,  3599,  null,       'SALE', 1, 4,  '/sneaker-sale',
   'End of season sneaker bonanza across top brands, all sizes in stock.'],
  ['dl_04', 'st_amazon',   'Fire-Boltt Ninja Call Pro Smartwatch',                'electronics', 4999,  1299,  null,       'LOOT', 1, 2,  '/fire-boltt-ninja',
   'Bluetooth calling smartwatch with 1.83" display and 100+ sports modes at an all-time-low price.'],
  ['dl_05', 'st_nykaa',    'Nykaa Pink Friday: Top Beauty Minis under ₹299',      'beauty',      999,   299,   'PINKMINI', 'NEW',  0, 6,  '/pink-friday-minis',
   'Travel-size bestsellers from Maybelline, Lakmé, MAC & more.'],
  ['dl_06', 'st_zomato',   'Zomato Gold 3-Month Membership at ₹99',               'food',        399,   99,    'GOLD99',   'HOT',  1, 5,  '/gold-membership',
   'Free delivery + up to 30% off dining. Pays for itself in one order.'],
  ['dl_07', 'st_croma',    'LG 55" 4K UHD Smart TV (2026 model)',                 'electronics', 74999, 42999, null,       'DEAL', 0, 8,  '/lg-55-uhd',
   'WebOS, Dolby Vision, 3 HDMI ports. Effective price drops further with HDFC EMI offer.'],
  ['dl_08', 'st_swiggy',   'Swiggy One 3-Month Membership at ₹149',               'food',        499,   149,   null,       'NEW',  0, 7,  '/swiggy-one',
   'Unlimited free deliveries on food and Instamart above ₹149.'],
  ['dl_09', 'st_mmt',      'Goa Flights Sale: Delhi/Mumbai from ₹1,999',          'travel',      4500,  1999,  'GOFLY',    'SALE', 1, 10, '/goa-flights',
   'Limited-window fares on IndiGo & Akasa. Combine with ICICI card for 12% extra off.'],
  ['dl_10', 'st_bigbasket','Fortune Sunlite Oil 5L Pouch',                        'grocery',     975,   689,   null,       'DEAL', 0, 4,  '/fortune-oil-5l',
   'Household staple at its lowest price this quarter.'],
  ['dl_11', 'st_flipkart', 'Nothing Phone (3a) 5G (8GB/256GB)',                   'electronics', 29999, 22999, null,       'HOT',  1, 5,  '/nothing-phone-3a',
   'Glyph interface, clean OS, 50MP main sensor — with card offer it beats every rival at this price.'],
  ['dl_12', 'st_ajio',     'AJIO Big Bold Sale: Flat 60-80% OFF',                 'fashion',     4999,  1499,  'BOLD60',   'SALE', 1, 6,  '/big-bold-sale',
   'Levi\'s, U.S. Polo, Puma and 4,000+ brands. Extra 10% off on first app order.'],
  ['dl_13', 'st_dominos',  'Two Medium Pizzas at ₹99 each (Wednesday only)',      'food',        398,   198,   'WED99',    'LOOT', 1, 1,  '/wednesday-offer',
   'The classic Wednesday BOGO-beater. Valid on hand-tossed medium range.'],
  ['dl_14', 'st_amazon',   'Kindle Paperwhite (16GB, 2026 release)',              'electronics', 16999, 12999, null,       'DEAL', 0, 9,  '/kindle-paperwhite',
   'Waterproof, 300ppi, weeks of battery. Rarely discounted — grab it.'],
  ['dl_15', 'st_tatacliq', 'Titan & Fastrack Watches: Min 40% OFF',               'fashion',     5995,  2999,  null,       'SALE', 0, 7,  '/watch-sale',
   'Authentic Titan-family brands with manufacturer warranty.'],
  ['dl_16', 'st_myntra',   'H&M & Zara Dresses under ₹1,299',                     'fashion',     3299,  1299,  null,       'NEW',  0, 5,  '/dresses-sale',
   'Fresh summer collection at clearance prices.'],
  ['dl_17', 'st_croma',    'Sony WH-CH720N Noise Cancelling Headphones',          'electronics', 14990, 8990,  null,       'DEAL', 0, 6,  '/sony-wh-ch720n',
   'Lightest full-size ANC in its class, 35-hour battery.'],
  ['dl_18', 'st_bigbasket','BB Royal Basmati Rice 10kg',                          'grocery',     1450,  999,   'BBRICE',   'DEAL', 0, 5,  '/basmati-10kg',
   'Aged basmati, bulk pack. Stack Paytm UPI cashback on top.'],
];

// ── Coupons (store-level codes) ───────────────────────────────────────────────
const COUPONS = [
  ['cp_1', 'st_myntra',   'MYNTRA200',  'Flat ₹200 OFF above ₹1,499',        'Flat ₹200 OFF',   1499, 10, 1],
  ['cp_2', 'st_ajio',     'AJIOFIRST',  'Extra 10% OFF on first app order',  'Extra 10% OFF',   999,  15, 1],
  ['cp_3', 'st_nykaa',    'NYKAANEW',   '₹300 OFF on first order',           '₹300 OFF',        999,  20, 1],
  ['cp_4', 'st_zomato',   'PARTY40',    '40% OFF up to ₹80 (new users)',     '40% OFF',         159,  6,  1],
  ['cp_5', 'st_swiggy',   'WELCOME50',  '50% OFF up to ₹100 (first order)',  '50% OFF',         149,  6,  1],
  ['cp_6', 'st_mmt',      'MMTSTAY',    '₹1,200 OFF on domestic hotels',     '₹1,200 OFF',      3500, 12, 0],
  ['cp_7', 'st_dominos',  'PIZZA30',    '30% OFF up to ₹150',                '30% OFF',         400,  4,  1],
  ['cp_8', 'st_tatacliq', 'CLIQ500',    '₹500 OFF above ₹2,999',             '₹500 OFF',        2999, 9,  0],
];

// ── Banners ───────────────────────────────────────────────────────────────────
const BANNERS = [
  ['bn_1', 'The True Price Revolution', 'Every deal shows product discount + card offer + coupon — stacked into one real price', '#4f46e5', '/deals',                 1],
  ['bn_2', 'This Week\'s Card Offers',  'HDFC 10% on Amazon · ICICI 10% on Flipkart · SBI 20% on Zomato',                        '#0d9488', '/bank-offers',           2],
  ['bn_3', 'Loot: boAt Airdopes ₹1,099','42-hour playback TWS at 75% off — with UPI cashback it\'s even lower',                  '#e11d48', '/deal/boat-airdopes-141-tws-earbuds-42h-playback', 3],
];

async function seed() {
  console.log(`[Seed] driver: ${driver}`);

  // Admin
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
  await query(`INSERT IGNORE INTO admins (id, name, email, password_hash) VALUES (?, ?, ?, ?)`,
    ['adm_1', 'Admin', 'admin@indiaoffers.in', hash]);

  for (const [id, name, color, cat, url, affType, cb] of STORES) {
    await query(`
      INSERT IGNORE INTO stores (id, slug, name, color, category, description, website_url, affiliate_url, affiliate_type, cashback_text, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, slugify(name), name, color, cat, `${name} deals, coupons and bank offers — all stacked on IndiaOffers.`, url, url, affType, cb]);
  }

  for (const [id, bank, instrument, title, type, value, cap, minOrder, storeId, code, validDays] of BANK_OFFERS) {
    await query(`
      INSERT IGNORE INTO bank_offers
        (id, bank, instrument, title, description, discount_type, discount_value, max_discount, min_order,
         store_id, promo_code, valid_from, valid_till, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, bank, instrument, title,
        `${title}. Automatically applied at payment${code ? ` with code ${code}` : ''}. T&Cs apply.`,
        type, value, cap, minOrder, storeId, code, today(), day(validDays)]);
  }

  for (const [id, storeId, title, cat, mrp, price, code, badge, trending, expiryDays, path, desc] of DEALS) {
    const store = STORES.find(s => s[0] === storeId);
    const howTo = JSON.stringify([
      `Click "Grab this deal" — you'll land on ${store[1]}`,
      code ? `Apply code ${code} at checkout` : 'The offer price reflects automatically',
      'Check the "Best way to pay" section here first — paying with the right card saves more',
      'Complete the payment. Done — you got the true lowest price.'
    ]);
    await query(`
      INSERT IGNORE INTO deals
        (id, slug, store_id, title, description, category, image_url, mrp, price, coupon_code,
         deal_url, how_to, badge, is_trending, is_active, expiry_date, posted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW())
    `, [id, slugify(title), storeId, title, desc, cat, img(id), mrp, price, code,
        store[4] + path, howTo, badge, trending, day(expiryDays)]);
  }

  for (const [id, storeId, code, title, distText, minOrder, expiryDays, verified] of COUPONS) {
    await query(`
      INSERT IGNORE INTO coupons (id, store_id, code, title, discount_text, min_order, expiry_date, is_verified, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, storeId, code, title, distText, minOrder, day(expiryDays), verified]);
  }

  for (const [id, title, subtitle, color, link, sort] of BANNERS) {
    await query(`
      INSERT IGNORE INTO banners (id, title, subtitle, image_url, bg_color, link_url, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, title, subtitle, null, color, link, sort]);
  }

  const counts = {};
  for (const t of ['stores', 'deals', 'bank_offers', 'coupons', 'banners', 'admins']) {
    counts[t] = (await query(`SELECT COUNT(*) AS c FROM ${t}`))[0].c;
  }
  console.log('[Seed] totals:', counts);
  console.log('[Seed] admin: admin@indiaoffers.in / admin123');
  process.exit(0);
}

seed().catch(err => { console.error('[Seed] failed:', err); process.exit(1); });
