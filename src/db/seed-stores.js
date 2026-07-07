'use strict';

/**
 * Replace the store roster with the curated 45-store list.
 *
 *   node src/db/seed-stores.js
 *
 * ⚠️  DESTRUCTIVE: clears store-dependent demo content (deals, coupons,
 *     bank offers, clicks) so the old seed stores can be removed, then inserts
 *     the 45 stores below with their names, links and downloaded logos.
 *     On SQLite a timestamped backup of the DB file is written first.
 *     bank_cards, guides and users are left untouched.
 *
 * Each store: [name, url, logoFile, category, color, affiliatePrefix]
 *   - url            : the store link (stored as website_url + affiliate_url)
 *   - logoFile       : file in public/img/stores/ → logo_url = /img/stores/<file>
 *   - affiliatePrefix: network tracking link the outbound URL is appended to
 *                      (use {click} for click id, {url} for the encoded link).
 *                      Blank for most — fill them in per store from the admin.
 */

const path = require('path');
const fs = require('fs');
const db = require('./index');
const { query, uid, slugify } = db;

// vCommission example the user provided for Jivisa (click-id token wired to {click}).
const JIVISA_PREFIX =
  'https://track.vcommission.com/click?campaign_id=13410&pub_id=100668&p1={click}&source={your-sub-aff-id}&url=';

const PALETTE = ['#4f46e5', '#0ea5e9', '#059669', '#d946ef', '#f59e0b', '#ef4444',
  '#8b5cf6', '#14b8a6', '#ec4899', '#f97316', '#0891b2', '#65a30d'];

// name, url, logoFile, category, prefix
const STORES = [
  ['Lavie',                        'https://www.lavieworld.com/',                              'lavieworld.png',            'fashion',     ''],
  ['Elver',                        'https://elver.in/collections/all',                          'elver.jpg',                 'fashion',     ''],
  ['The Bear House',               'https://thebearhouse.com/',                                 'thebearhouse.png',          'fashion',     ''],
  ['Sirona',                       'https://thesirona.com/collections/all-products',            'thesirona.jpg',             'beauty',      ''],
  ['Jivisa',                       'https://jivisa.in/',                                        'jivisa.png',                'fashion',     JIVISA_PREFIX],
  ['Sanskruti Homes',              'https://www.sanskrutihomes.in/',                            'sanskrutihomes.jpg',        'shopping',    ''],
  ['Brillare',                     'https://www.brillare.co.in/',                               'brillare.jpg',              'beauty',      ''],
  ['The Pant Project',             'https://pantproject.com/',                                  'pantproject.jpg',           'fashion',     ''],
  ['Better Nutrition',             'https://betternutrition.in/',                               'betternutrition.png',       'food',        ''],
  ['Guardian',                     'https://www.guardian.in/',                                  'guardian.png',              'food',        ''],
  ['Fuel One',                     'https://www.fuelone.in/categories/proteins?navKey=CL-5895', 'fuelone.svg',               'food',        ''],
  ['Gritzo',                       'https://www.gritzo.com/sale/nutrition-range',               'gritzo.svg',                'food',        ''],
  ['Ruhe',                         'https://ruheindia.com/',                                    'ruheindia.png',             'beauty',      ''],
  ['Wonderchef',                   'https://www.wonderchef.com/',                               'wonderchef.png',            'shopping',    ''],
  ['Iba',                          'https://ibacosmetics.com/',                                 'ibacosmetics.jpg',          'beauty',      ''],
  ['Indus Valley',                 'https://www.buyindusvalley.in/',                            'buyindusvalley.jpg',        'beauty',      ''],
  ['The Natural Wash',             'https://www.thenaturalwash.com',                            'thenaturalwash.png',        'beauty',      ''],
  ['Bajaj General Insurance',      'https://www.bajajgeneralinsurance.com/health-insurance-online/product', 'bajajgeneralinsurance.png', 'shopping', ''],
  ['Milton',                       'https://www.milton.in',                                     'milton.png',                'shopping',    ''],
  ['Nourish Mantra',               'https://nourishmantra.in/',                                 'nourishmantra.png',         'beauty',      ''],
  ['Clove',                        'https://cloveoralcare.com/',                                'cloveoralcare.png',         'beauty',      ''],
  ['Nilkamal',                     'https://www.nilkamalfurniture.com/',                        'nilkamalfurniture.png',     'shopping',    ''],
  ['IGP',                          'https://www.igp.com',                                       'igp.png',                   'shopping',    ''],
  ['Bacca Bucci',                  'https://baccabucci.com/',                                   'baccabucci.png',            'fashion',     ''],
  ["Levi's",                       'https://levi.in/collections/new-arrivals',                  'levi.svg',                  'fashion',     ''],
  ['Salty',                        'https://salty.co.in/',                                      'salty.png',                 'fashion',     ''],
  ['Perfora',                      'https://perforacare.com/',                                  'perforacare.png',           'beauty',      ''],
  ["Neeman's",                     'https://neemans.com',                                       'neemans.png',               'fashion',     ''],
  ['GUVI',                         'https://www.guvi.in/',                                      'guvi.png',                  'electronics', ''],
  ['Timex',                        'https://shop.timexindia.com/',                              'shop-timexindia.svg',       'fashion',     ''],
  ['MyMuse',                       'https://mymuse.in/',                                        'mymuse.jpg',                'beauty',      ''],
  ['Vaaree',                       'https://vaaree.com/',                                       'vaaree.jpg',                'shopping',    ''],
  ['AJIO',                         'https://www.ajio.com/',                                     'ajio.png',                  'fashion',     ''],
  ['Moglix',                       'https://www.moglix.com/',                                   'moglix.png',                'shopping',    ''],
  ['Noise',                        'https://www.gonoise.com/collections/special-deals',         'gonoise.png',               'electronics', ''],
  ['UNIQLO',                       'https://www.uniqlo.com/in/en/',                             'uniqlo.png',                'fashion',     ''],
  ['TrueBasics',                   'https://www.truebasics.com/sale/truebasics-best-sellers',   'truebasics.png',            'food',        ''],
  ['The Man Company',              'https://www.themancompany.com/collections/grooming-days-ahead', 'themancompany.jpg',     'beauty',      ''],
  ['Pepperfry',                    'https://www.pepperfry.com/',                                'pepperfry.ico',             'shopping',    ''],
  ['Neesh',                        'https://neeshperfumes.com/',                                'neeshperfumes.jpg',         'beauty',      ''],
  ['MuscleBlaze',                  'https://www.muscleblaze.com/sale/muscleblaze-top-products', 'muscleblaze.svg',           'food',        ''],
  ['Kapiva',                       'https://kapiva.in/shop-all',                                'kapiva.png',                'food',        ''],
  ['HK Vitals',                    'https://www.hkvitals.com/sale/wellness-sale-essentials',    'hkvitals.png',              'food',        ''],
  ['HealthKart',                   'https://www.healthkart.com/sale/healthkart-top-products',   'healthkart.ico',            'food',        ''],
  ['FirstCry',                     'https://www.firstcry.com',                                  'firstcry.jpg',              'shopping',    ''],
];

async function run() {
  // 1. Backup (SQLite only — the file is the whole DB).
  if (db.driver !== 'mysql') {
    const dbFile = path.join(__dirname, '..', '..', 'data', 'indiaoffers.db');
    if (fs.existsSync(dbFile)) {
      const bak = dbFile.replace(/\.db$/, `.backup-${Date.now()}.db`);
      fs.copyFileSync(dbFile, bak);
      console.log('Backup written →', path.basename(bak));
    }
  }

  // 2. Clear store-dependent demo content (FK-safe order). deals & coupons have
  //    hard FKs to stores; clicks/bank_offers/guide_items are soft references.
  console.log('Clearing old store-dependent content…');
  await query('UPDATE guide_items SET deal_id = NULL');
  await query('DELETE FROM clicks');
  await query('DELETE FROM deals');
  await query('DELETE FROM coupons');
  await query('DELETE FROM bank_offers');
  await query('DELETE FROM stores');

  // 3. Insert the 45 stores.
  let i = 0;
  for (const [name, url, logoFile, category, prefix] of STORES) {
    const logoPath = path.join(__dirname, '..', '..', 'public', 'img', 'stores', logoFile);
    if (!fs.existsSync(logoPath)) console.warn('  ! missing logo file:', logoFile, 'for', name);
    const id = uid('st');
    const slug = slugify(name);
    const color = PALETTE[i % PALETTE.length];
    await query(`
      INSERT INTO stores
        (id, slug, name, color, logo_url, category, description, website_url,
         affiliate_url, affiliate_type, affiliate_prefix, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'none', ?, 1)
    `, [id, slug, name, color, '/img/stores/' + logoFile, category,
        `${name} deals, offers and coupons on IndiaOffers.`, url, url, prefix || null]);
    i++;
  }

  const [{ c }] = await query('SELECT COUNT(*) AS c FROM stores');
  console.log(`\nDone — ${c} stores in the database.`);
  const withPrefix = await query("SELECT name FROM stores WHERE affiliate_prefix IS NOT NULL AND affiliate_prefix <> ''");
  console.log('Stores with an affiliate prefix set:', withPrefix.map(s => s.name).join(', ') || '(none)');
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
