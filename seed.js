/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  IndiaOffers.in — Database seeder (idempotent)
 *
 *  Run: npm run db:seed
 *  Creates demo accounts, 22 stores, 30 deals and a demo pixel merchant.
 *  Safe to re-run — existing rows are left untouched.
 *
 *  Demo logins:  user@demo.com / user123   ·   admin@indiaoffers.in / admin123
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, driver } = require('./db');

const today = () => new Date().toISOString().slice(0, 10);
const daysFromNow = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const STORES = [
  ['s1',  'Flipkart',   0.08, '8%',  '#2874f0', 'F', 'shopping',    "India's leading e-commerce marketplace.",      'https://www.flipkart.com',   'flipkart', 4.5, 125000],
  ['s2',  'Amazon',     0.06, '6%',  '#ff9900', 'A', 'shopping',    "Earth's most customer-centric company.",       'https://www.amazon.in',      'amazon',   4.7, 250000],
  ['s3',  'Myntra',     0.10, '10%', '#ff3e6c', 'M', 'fashion',     "India's favorite fashion destination.",        'https://www.myntra.com',     'direct',   4.4, 98000],
  ['s4',  'Ajio',       0.12, '12%', '#000000', 'A', 'fashion',     'Fashion and lifestyle products.',              'https://www.ajio.com',       'direct',   4.3, 75000],
  ['s5',  'Nykaa',      0.07, '7%',  '#e91e63', 'N', 'beauty',      "India's top beauty destination.",              'https://www.nykaa.com',      'direct',   4.6, 65000],
  ['s6',  'Zomato',     0.15, '15%', '#e23744', 'Z', 'food',        'Online food delivery.',                        'https://www.zomato.com',     'direct',   4.2, 180000],
  ['s7',  'Swiggy',     0.12, '12%', '#fc8019', 'S', 'food',        'Food delivery and groceries.',                 'https://www.swiggy.com',     'direct',   4.3, 165000],
  ['s8',  'MakeMyTrip', 0.05, '5%',  '#2196f3', 'M', 'travel',      'Book flights, hotels, holidays.',              'https://www.makemytrip.com', 'direct',   4.4, 89000],
  ['s9',  'BigBasket',  0.08, '8%',  '#5b9bd5', 'B', 'grocery',     "India's largest online grocery.",              'https://www.bigbasket.com',  'direct',   4.5, 110000],
  ['s10', 'Croma',      0.09, '9%',  '#1976d2', 'C', 'electronics', 'Electronics retail chain.',                    'https://www.croma.com',      'direct',   4.3, 72000],
  ['s11', 'Lenskart',   0.11, '11%', '#ff5722', 'L', 'fashion',     'Eyewear online.',                              'https://www.lenskart.com',   'direct',   4.5, 58000],
  ['s12', 'Pharmeasy',  0.18, '18%', '#4caf50', 'P', 'health',      'Online pharmacy.',                             'https://pharmeasy.in',       'direct',   4.2, 95000],
  ['s13', 'Paytm',      0.10, '10%', '#00baf2', 'P', 'recharge',    'Mobile recharge and bill payments.',           'https://paytm.com',          'direct',   4.1, 220000],
  ['s14', 'Goibibo',    0.06, '6%',  '#ed1c24', 'G', 'travel',      'Book hotels, flights and buses.',              'https://www.goibibo.com',    'direct',   4.3, 78000],
  ['s15', 'Tata Cliq',  0.07, '7%',  '#673ab7', 'T', 'shopping',    'Premium shopping destination.',                'https://www.tatacliq.com',   'direct',   4.2, 45000],
  ['s16', 'FirstCry',   0.09, '9%',  '#ff6f00', 'F', 'shopping',    'Baby and kids products.',                      'https://www.firstcry.com',   'direct',   4.4, 62000],
  ['s17', 'Pepperfry',  0.08, '8%',  '#795548', 'P', 'shopping',    'Furniture and home decor.',                    'https://www.pepperfry.com',  'direct',   4.1, 38000],
  ['s18', 'BookMyShow', 0.06, '6%',  '#c92127', 'B', 'shopping',    'Book movie tickets and events.',               'https://in.bookmyshow.com',  'direct',   4.5, 145000],
  ['s19', 'Dominos',    0.10, '10%', '#006491', 'D', 'food',        'Pizza delivery.',                              'https://www.dominos.co.in',  'direct',   4.3, 95000],
  ['s20', 'Uber',       0.08, '8%',  '#000000', 'U', 'travel',      'Ride-hailing services.',                       'https://www.uber.com',       'direct',   4.0, 180000],
  ['s21', 'Meesho',     0.12, '12%', '#e91e63', 'M', 'fashion',     'Online shopping at best prices.',              'https://www.meesho.com',     'direct',   4.1, 150000],
  ['s22', '1mg',        0.15, '15%', '#00a651', '1', 'health',      'Medicines and lab tests.',                     'https://www.1mg.com',        'direct',   4.4, 85000],
];

// [id, storeId, title, category, code, type, badge, desc, minOrder, uses, trending, expiring, expiryDays, image]
const IMG = {
  mega   : 'https://image.qwenlm.ai/public_source/de16efc1-1c56-46b1-bb76-02fd3509169f/171ff5d1b-118e-48c2-a0cf-9c3414a0c790.png',
  elec   : 'https://image.qwenlm.ai/public_source/de16efc1-1c56-46b1-bb76-02fd3509169f/13c5458fc-3ae8-41b6-8470-81f01d5cbf6c.png',
  fashion: 'https://image.qwenlm.ai/public_source/de16efc1-1c56-46b1-bb76-02fd3509169f/1c0f58d22-565f-4e60-94ff-0f6f525ee50e.png',
  food   : 'https://image.qwenlm.ai/public_source/de16efc1-1c56-46b1-bb76-02fd3509169f/1186bcab4-ee8e-428e-b305-31e4d36e9830.png',
};

const DEALS = [
  ['d1',  's1',  'Flat 70% OFF on Electronics',    'electronics', 'FLIP70',      'deal',   'HOT',      'Massive discounts on smartphones, laptops & more.', 999,   1245, 1, 0, 2,  IMG.elec],
  ['d2',  's3',  '50% OFF on Fashion Brands',      'fashion',     'MYNTRA50',    'deal',   'NEW',      'Trendy clothes, shoes & accessories at half price.', 799,   892,  1, 0, 5,  IMG.fashion],
  ['d3',  's6',  'Free Delivery + 20% Cashback',   'food',        'ZOMATO20',    'coupon', 'EXPIRING', 'Order your favorite food and earn cashback.',        299,   2341, 1, 1, 1,  IMG.food],
  ['d4',  's2',  'Mega Sale - Up to 80% OFF',      'shopping',    'AMAZON80',    'deal',   'MEGA',     'Everything from electronics to home essentials.',    499,   3456, 1, 0, 3,  IMG.mega],
  ['d5',  's8',  'Flat 40% OFF on Flights',        'travel',      'MMT40',       'coupon', 'TRAVEL',   'Book domestic & international flights.',             2999,  567,  0, 0, 7,  null],
  ['d6',  's4',  'Buy 1 Get 1 Free',               'fashion',     'AJIOBOGO',    'deal',   'BOGO',     'Fashion apparel, footwear & accessories.',           599,   1123, 1, 0, 4,  null],
  ['d7',  's5',  '30% OFF on Beauty Products',     'beauty',      'NYKAA30',     'deal',   'BEAUTY',   'Premium skincare, makeup & fragrances.',             499,   789,  0, 0, 6,  null],
  ['d8',  's13', 'Recharge & Get 15% Cashback',    'recharge',    'PAYTM15',     'coupon', 'EXPIRING', 'Mobile, DTH & bill payments cashback.',              99,    4521, 0, 1, 1,  null],
  ['d9',  's9',  '25% OFF on Groceries',           'grocery',     'BB25',        'deal',   'GROCERY',  'Fresh fruits, vegetables & daily essentials.',       399,   2109, 0, 1, 2,  null],
  ['d10', 's12', 'Free Medicine Delivery',         'health',      'PEFREE',      'coupon', 'HEALTH',   'Order medicines with free delivery.',                199,   1567, 0, 0, 10, null],
  ['d11', 's10', '60% OFF on Laptops',             'electronics', 'CROMA60',     'deal',   'TECH',     'Latest laptops from top brands.',                    24999, 432,  0, 0, 5,  null],
  ['d12', 's11', '50% OFF on Eyewear',             'fashion',     'LENS50',      'deal',   'FASHION',  'Spectacles, sunglasses & contact lenses.',           999,   678,  1, 0, 3,  null],
  ['d13', 's7',  '60% OFF + Free Delivery',        'food',        'SWIGGY60',    'coupon', 'FOOD',     'Order from 10,000+ restaurants.',                    249,   3210, 0, 0, 4,  null],
  ['d14', 's14', '₹1500 OFF on Hotels',            'travel',      'GOIBIBO1500', 'deal',   'HOTEL',    'Book any hotel and save big.',                       1999,  345,  0, 0, 8,  null],
  ['d15', 's15', 'Flat 40% OFF on Luxury',         'shopping',    'TATACLIQ40',  'deal',   'LUXURY',   'Premium brands at discounted prices.',               1999,  234,  0, 0, 6,  null],
  ['d16', 's16', '70% OFF on Baby Products',       'shopping',    'FIRSTCRY70',  'deal',   'BABY',     'Toys, clothes, gear for little ones.',               499,   567,  0, 0, 5,  null],
  ['d17', 's17', '50% OFF on Furniture',           'shopping',    'PEPPER50',    'deal',   'HOME',     'Transform your home with stylish furniture.',        4999,  189,  0, 0, 7,  null],
  ['d18', 's18', '₹125 OFF on Movies',             'shopping',    'BMS125',      'coupon', 'MOVIE',    'Book movie tickets and save.',                       400,   5678, 0, 0, 3,  null],
  ['d19', 's19', '60% OFF on Pizzas',              'food',        'DOM60',       'coupon', 'PIZZA',    'Order your favorite pizzas.',                        399,   2345, 0, 1, 2,  null],
  ['d20', 's20', 'Free Rides up to ₹150',          'travel',      'UBERFREE',    'coupon', 'RIDE',     'Free rides on first 3 trips.',                       99,    4321, 0, 0, 4,  null],
  ['d21', 's21', '80% OFF + Extra Cashback',       'fashion',     'MEESHO80',    'deal',   'MEGA',     'Massive discounts on fashion.',                      299,   6789, 1, 0, 6,  null],
  ['d22', 's22', '25% OFF + Lab Test Free',        'health',      '1MG25',       'deal',   'HEALTH',   'Medicines and free health checkups.',                299,   890,  0, 0, 8,  null],
  ['d23', 's1',  '₹1000 OFF on Smartphones',       'electronics', 'FLIP1000',    'deal',   'PHONE',    'Save big on latest smartphones.',                    9999,  1234, 0, 0, 3,  null],
  ['d24', 's2',  'Prime Day Special - 90% OFF',    'shopping',    'PRIME90',     'deal',   'PRIME',    'Exclusive Prime member deals.',                      299,   7890, 0, 1, 2,  null],
  ['d25', 's3',  'End of Reason Sale - 80% OFF',   'fashion',     'EORS80',      'deal',   'EORS',     'Biggest fashion sale of the year.',                  599,   4567, 1, 0, 4,  null],
  ['d26', 's6',  '₹200 OFF on First Order',        'food',        'ZNEW200',     'coupon', 'NEW',      'New users special.',                                 299,   3456, 0, 0, 10, null],
  ['d27', 's8',  'Bus Booking - 30% OFF',          'travel',      'BUS30',       'coupon', 'BUS',      'Book bus tickets across India.',                     499,   678,  0, 0, 5,  null],
  ['d28', 's9',  'Free Delivery on ₹499+',         'grocery',     'BBFREE',      'coupon', 'FREE',     'Free delivery above ₹499.',                          499,   5678, 0, 0, 7,  null],
  ['d29', 's10', 'Exchange Bonus ₹5000',           'electronics', 'CROMAEX5000', 'deal',   'EXCHANGE', 'Extra ₹5000 on exchange.',                           14999, 234,  0, 0, 6,  null],
  ['d30', 's5',  'Buy 2 Get 1 Free Makeup',        'beauty',      'NYKAA21',     'deal',   'MAKEUP',   'Mix and match on makeup.',                           999,   890,  0, 0, 5,  null],
];


// Product-style data per deal: [originalPrice, dealPrice, productPath]
// how-to steps are generated below; image uses picsum placeholder seeded per deal id
const PRODUCT_DATA = {
  d1:  [79999, 23999, '/electronics-sale'],
  d2:  [3999,  1999,  '/fashion-sale'],
  d3:  [499,   399,   '/order'],
  d4:  [4999,  999,   '/mega-sale'],
  d5:  [8999,  5399,  '/flights'],
  d6:  [2998,  1499,  '/bogo'],
  d7:  [2499,  1749,  '/beauty'],
  d8:  [599,   509,   '/recharge'],
  d9:  [1200,  900,   '/groceries'],
  d10: [899,   735,   '/medicines'],
  d11: [89999, 35999, '/laptops'],
  d12: [4000,  2000,  '/eyewear'],
  d13: [600,   240,   '/food'],
  d14: [6999,  5499,  '/hotels'],
  d15: [9999,  5999,  '/luxury'],
  d16: [1999,  599,   '/baby-products'],
  d17: [29999, 14999, '/furniture'],
  d18: [500,   375,   '/movies'],
  d19: [999,   399,   '/pizza'],
  d20: [450,   300,   '/rides'],
  d21: [1499,  299,   '/fashion'],
  d22: [1200,  900,   '/medicines'],
  d23: [24999, 23999, '/smartphones'],
  d24: [2999,  299,   '/prime-day'],
  d25: [4995,  999,   '/eors'],
  d26: [499,   299,   '/first-order'],
  d27: [1200,  840,   '/bus-tickets'],
  d28: [499,   499,   '/free-delivery'],
  d29: [49999, 34999, '/exchange'],
  d30: [2997,  1998,  '/makeup'],
};

function howToSteps(storeName, code, type) {
  const steps = [
    `Click the "Get Deal" button below — you'll be redirected to ${storeName}`,
    'Add your product/service to the cart as usual',
  ];
  if (code) steps.push(`Apply coupon code ${code} at checkout`);
  steps.push('Complete the payment — the discount applies instantly');
  steps.push('Your IndiaOffers cashback tracks automatically within 30 minutes and shows in "Track Orders"');
  return steps;
}

async function seed() {
  console.log(`[Seed] Driver: ${driver}`);

  // ── Users ──────────────────────────────────────────────────────────────────
  const adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
  const demoHash  = bcrypt.hashSync('user123', 10);

  await query(`
    INSERT IGNORE INTO users (id, name, email, phone, password_hash, referral_code, wallet, total_earned, is_admin, joined)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['admin_1', 'Admin', 'admin@indiaoffers.in', '9999999999', adminHash, 'ADMIN2024', 0, 0, 1, today()]);

  await query(`
    INSERT IGNORE INTO users (id, name, email, phone, password_hash, referral_code, wallet, total_earned, is_admin, joined)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, ['u_demo', 'Demo User', 'user@demo.com', '9876543210', demoHash, 'DEMO2026', 100, 0, 0, today()]);

  // ── Stores ─────────────────────────────────────────────────────────────────
  let storeCount = 0;
  for (const [id, name, rate, label, color, initial, category, desc, url, type, rating, totalUsers] of STORES) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dealsCount = DEALS.filter(d => d[1] === id).length;
    const r = await query(`
      INSERT IGNORE INTO stores
        (id, name, slug, description, color, initial, category, cashback_rate, cashback_label,
         affiliate_url, affiliate_type, is_active, is_featured, deals_count, total_users, rating)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `, [id, name, slug, desc, color, initial, category, rate, label, url, type,
        totalUsers > 100000 ? 1 : 0, dealsCount, totalUsers, rating]);
    storeCount += r.affectedRows || 0;
  }

  // ── Deals ──────────────────────────────────────────────────────────────────
  let dealCount = 0;
  for (const [id, storeId, title, cat, code, type, badge, desc, minOrder, uses, trending, expiring, expiryDays, image] of DEALS) {
    const store = STORES.find(s => s[0] === storeId);
    const [origP, dealP, prodPath] = PRODUCT_DATA[id] || [null, null, ''];
    const storeUrl = store[8];
    const dealImg = image || `https://picsum.photos/seed/${id}io/640/420`;
    const r = await query(`
      INSERT IGNORE INTO deals
        (id, store_id, title, description, coupon_code, deal_type, category, cashback_rate, cashback_label,
         min_order, image_url, badge, is_trending, is_expiring, is_active, uses_count, expiry_date, start_date,
         original_price, deal_price, deal_url, how_to_get)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    `, [id, storeId, title, desc, code, type, cat, store[2], store[3],
        minOrder, dealImg, badge, trending, expiring, uses, daysFromNow(expiryDays), today(),
        origP, dealP, storeUrl + prodPath, JSON.stringify(howToSteps(store[1], code, type))]);
    dealCount += r.affectedRows || 0;
  }

  // ── Demo pixel merchant (for Shopify/WooCommerce universal pixel testing) ──
  const crypto = require('crypto');
  await query(`
    INSERT IGNORE INTO merchants (id, store_id, name, domain, cashback_rate, secret_key, is_active, contact_email)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `, ['m_demo', 's15', 'Demo Shopify Store', 'demo-store.myshopify.com', 0.05,
      crypto.randomBytes(24).toString('hex'), 'merchant@demo.com']);

  // ── Hero banners (admin-managed) ───────────────────────────────────────────
  const BANNERS = [
    ['b_1', 'Mega Electronics Fest',  'Up to 70% OFF on laptops, phones & more + extra cashback', '#f59e0b', 'd1',  's1', 1],
    ['b_2', 'Prime Day Special',      'Members save up to 90% across categories',                 '#0ea5e9', 'd24', 's2', 2],
    ['b_3', 'End of Reason Sale',     'Fashion at 50-80% OFF — biggest sale of the season',       '#ec4899', 'd25', 's3', 3],
    ['b_4', 'Foodie Weekend',         'Free delivery + 20% cashback on every order',              '#ef4444', 'd3',  's6', 4],
    ['b_5', 'Travel More, Pay Less',  'Flat 40% OFF on flights + hotel combos',                   '#8b5cf6', 'd5',  's8', 5],
  ];
  for (const [id, title, subtitle, color, dealId, storeId, sort] of BANNERS) {
    await query(`
      INSERT IGNORE INTO banners (id, title, subtitle, image_url, bg_color, deal_id, store_id, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, title, subtitle, `https://picsum.photos/seed/${id}io/900/500`, color, dealId, storeId, sort]);
  }

  const users  = await query('SELECT COUNT(*) AS c FROM users');
  const stores = await query('SELECT COUNT(*) AS c FROM stores');
  const deals  = await query('SELECT COUNT(*) AS c FROM deals');
  console.log(`[Seed] Inserted ${storeCount} stores, ${dealCount} deals this run.`);
  console.log(`[Seed] Totals — users: ${users[0].c}, stores: ${stores[0].c}, deals: ${deals[0].c}`);
  console.log('[Seed] Demo logins:  user@demo.com / user123   ·   admin@indiaoffers.in / admin123');
  process.exit(0);
}

seed().catch(err => { console.error('[Seed] Failed:', err); process.exit(1); });
