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
const J = arr => JSON.stringify(arr);

// ── Stores — India's top e-commerce destinations ──────────────────────────────
// [id, name, color, category, url, affiliateType, cashbackText]
const STORES = [
  ['st_amazon',    'Amazon',           '#ff9900', 'Marketplace',  'https://www.amazon.in',        'amazon',   'Upto 4% IO rewards'],
  ['st_flipkart',  'Flipkart',         '#2874f0', 'Marketplace',  'https://www.flipkart.com',     'flipkart', 'Upto 5% IO rewards'],
  ['st_myntra',    'Myntra',           '#ff3e6c', 'Fashion',      'https://www.myntra.com',       'none',     'Upto 6% IO rewards'],
  ['st_ajio',      'AJIO',             '#2f2f2f', 'Fashion',      'https://www.ajio.com',         'none',     'Upto 6% IO rewards'],
  ['st_meesho',    'Meesho',           '#9f2089', 'Marketplace',  'https://www.meesho.com',       'none',     'Upto 5% IO rewards'],
  ['st_nykaa',     'Nykaa',            '#e91e63', 'Beauty',       'https://www.nykaa.com',        'none',     'Upto 7% IO rewards'],
  ['st_nykaafash', 'Nykaa Fashion',    '#fc2779', 'Fashion',      'https://www.nykaafashion.com', 'none',     null],
  ['st_tatacliq',  'Tata CLiQ',        '#da1c5c', 'Marketplace',  'https://www.tatacliq.com',     'none',     null],
  ['st_reliance',  'Reliance Digital', '#e42529', 'Electronics',  'https://www.reliancedigital.in','none',    null],
  ['st_croma',     'Croma',            '#1ba39b', 'Electronics',  'https://www.croma.com',        'none',     null],
  ['st_vijaysales','Vijay Sales',      '#e4002b', 'Electronics',  'https://www.vijaysales.com',   'none',     null],
  ['st_jiomart',   'JioMart',          '#0f3cc9', 'Grocery',      'https://www.jiomart.com',      'none',     null],
  ['st_bigbasket', 'BigBasket',        '#84c225', 'Grocery',      'https://www.bigbasket.com',    'none',     null],
  ['st_blinkit',   'Blinkit',          '#f8cb46', 'Grocery',      'https://www.blinkit.com',      'none',     null],
  ['st_zepto',     'Zepto',            '#5b0eb5', 'Grocery',      'https://www.zeptonow.com',     'none',     null],
  ['st_swiggy',    'Swiggy',           '#fc8019', 'Food',         'https://www.swiggy.com',       'none',     null],
  ['st_zomato',    'Zomato',           '#e23744', 'Food',         'https://www.zomato.com',       'none',     null],
  ['st_dominos',   "Domino's",         '#006491', 'Food',         'https://www.dominos.co.in',    'none',     null],
  ['st_firstcry',  'FirstCry',         '#f47c20', 'Baby',         'https://www.firstcry.com',     'none',     null],
  ['st_pharmeasy', 'PharmEasy',        '#10847e', 'Health',       'https://www.pharmeasy.in',     'none',     null],
  ['st_netmeds',   'Netmeds',          '#4caf50', 'Health',       'https://www.netmeds.com',      'none',     null],
  ['st_1mg',       'Tata 1mg',         '#ff6f61', 'Health',       'https://www.1mg.com',          'none',     null],
  ['st_lenskart',  'Lenskart',         '#11a3a3', 'Fashion',      'https://www.lenskart.com',     'none',     null],
  ['st_decathlon', 'Decathlon',        '#0082c3', 'Sports',       'https://www.decathlon.in',     'none',     null],
  ['st_boat',      'boAt Lifestyle',   '#ec1c24', 'Electronics',  'https://www.boat-lifestyle.com','none',    null],
  ['st_mamaearth', 'Mamaearth',        '#4b9560', 'Beauty',       'https://www.mamaearth.in',     'none',     null],
  ['st_souledstore','The Souled Store','#111111', 'Fashion',      'https://www.thesouledstore.com','none',    null],
  ['st_bewakoof',  'Bewakoof',         '#ffc107', 'Fashion',      'https://www.bewakoof.com',     'none',     null],
  ['st_snapdeal',  'Snapdeal',         '#e40046', 'Marketplace',  'https://www.snapdeal.com',     'none',     null],
  ['st_pepperfry', 'Pepperfry',        '#f16521', 'Furniture',    'https://www.pepperfry.com',    'none',     null],
  ['st_urbanladder','Urban Ladder',    '#2a2a2a', 'Furniture',    'https://www.urbanladder.com',  'none',     null],
  ['st_mmt',       'MakeMyTrip',       '#eb2226', 'Travel',       'https://www.makemytrip.com',   'none',     null],
  ['st_goibibo',   'Goibibo',          '#153b98', 'Travel',       'https://www.goibibo.com',      'none',     null],
  ['st_easemytrip','EaseMyTrip',       '#ee6f00', 'Travel',       'https://www.easemytrip.com',   'none',     null],
  ['st_cleartrip', 'Cleartrip',        '#ff6f00', 'Travel',       'https://www.cleartrip.com',    'none',     null],
  ['st_titan',     'Titan',            '#c8102e', 'Fashion',      'https://www.titan.co.in',      'none',     null],
  ['st_tanishq',   'Tanishq',          '#b8860b', 'Jewellery',    'https://www.tanishq.co.in',    'none',     null],
  ['st_caratlane', 'CaratLane',        '#ec297b', 'Jewellery',    'https://www.caratlane.com',    'none',     null],
  ['st_apple',     'Apple India',      '#555555', 'Electronics',  'https://www.apple.com/in',     'none',     null],
  ['st_samsung',   'Samsung Shop',     '#1428a0', 'Electronics',  'https://www.samsung.com/in',   'none',     null],
  ['st_puma',      'PUMA India',       '#111111', 'Fashion',      'https://in.puma.com',          'none',     null],
  ['st_adidas',    'adidas India',     '#000000', 'Fashion',      'https://www.adidas.co.in',     'none',     null],
];

// ── Bank cards to APPLY for (affiliate card sign-ups) ─────────────────────────
// [id, name, bank, network, type, tagline, joiningFee, annualFee, bestFor, benefits[], steps[], eligibility, applyUrl, videoUrl, featured, sort]
const BANK_CARDS = [
  ['bc_hdfc_millennia', 'HDFC Millennia Credit Card', 'HDFC Bank', 'Visa', 'credit',
    '5% cashback on Amazon, Flipkart, Myntra, Swiggy & more',
    '₹1,000 + GST', '₹1,000 + GST (waived on ₹1L spend)', 'Online shopping & dining',
    ['5% cashback on 10+ partner brands (Amazon, Flipkart, Swiggy, Zomato)', '1% cashback on all other spends',
     '₹1,000 worth gift vouchers on ₹1L quarterly spend', '8 complimentary domestic airport lounge visits/year',
     '1% fuel surcharge waiver'],
    ['Click "Apply Now" to go to HDFC Bank', 'Enter your PAN, mobile and basic KYC details',
     'Choose full-KYC video verification', 'Card is approved instantly for eligible customers and posted to you'],
    'Salaried ₹35,000/month or self-employed with ITR ₹6L/year', 'https://www.hdfcbank.com', 'https://www.youtube.com/watch?v=millennia', 1, 1],

  ['bc_sbi_cashback', 'SBI Cashback Credit Card', 'SBI', 'Visa', 'credit',
    'Flat 5% cashback on ALL online spends, no merchant restriction',
    '₹999 + GST', '₹999 + GST (waived on ₹2L spend)', 'Pure online cashback',
    ['5% cashback on any online spend (no brand cap on categories)', '1% cashback on offline spends',
     'Auto-credited to statement, no redemption needed', '1% fuel surcharge waiver'],
    ['Tap "Apply Now" for SBI Card', 'Fill the online application with PAN & income proof',
     'Complete video KYC', 'Track status on SBI Card portal — dispatched on approval'],
    'Good CIBIL score (750+), age 21-65', 'https://www.sbicard.com', 'https://www.youtube.com/watch?v=sbicashback', 1, 2],

  ['bc_icici_amazonpay', 'Amazon Pay ICICI Credit Card', 'ICICI Bank', 'Visa', 'credit',
    'Lifetime free · up to 5% back on Amazon',
    'Lifetime FREE', 'Lifetime FREE', 'Amazon shoppers',
    ['5% back for Prime members on Amazon', '3% back for non-Prime on Amazon', '2% back on 100+ Amazon Pay partners',
     '1% back on all other spends', 'No annual fee, ever'],
    ['Open Amazon app or click "Apply Now"', 'Sign in and check your pre-approved offer',
     'Submit KYC digitally', 'Instant approval — start using the virtual card immediately'],
    'Any Amazon.in account holder with valid KYC', 'https://www.amazon.in', 'https://www.youtube.com/watch?v=amazonpayicici', 1, 3],

  ['bc_axis_ace', 'Axis Bank ACE Credit Card', 'Axis Bank', 'Visa', 'credit',
    '5% cashback on bill payments & 4% on Swiggy/Zomato/Ola',
    '₹499 + GST', '₹499 + GST (waived on ₹2L spend)', 'Bills, food & cabs',
    ['5% cashback on Google Pay bill payments & recharges', '4% cashback on Swiggy, Zomato & Ola',
     '2% cashback on all other spends', '4 complimentary lounge visits/year'],
    ['Click "Apply Now" for Axis Bank', 'Enter PAN, mobile and income details',
     'Complete e-KYC / video KYC', 'Get approval and card dispatch tracking'],
    'Salaried or self-employed, age 18-70', 'https://www.axisbank.com', 'https://www.youtube.com/watch?v=axisace', 0, 4],

  ['bc_axis_flipkart', 'Flipkart Axis Bank Credit Card', 'Axis Bank', 'Mastercard', 'credit',
    '5% unlimited cashback on Flipkart & Myntra',
    '₹500 + GST', '₹500 + GST (waived on ₹2L spend)', 'Flipkart & Myntra loyalists',
    ['5% cashback on Flipkart, Myntra, Cleartrip', '4% on preferred partners (Swiggy, PVR, Uber)',
     '1.5% on everything else', '4 domestic lounge visits/year'],
    ['Click "Apply Now" on Flipkart or Axis', 'Check pre-approved offer with your details',
     'Finish KYC verification', 'Card added to Flipkart wallet on approval'],
    'Salaried ₹25,000/month, good credit history', 'https://www.flipkart.com', 'https://www.youtube.com/watch?v=flipkartaxis', 0, 5],

  ['bc_hdfc_regalia', 'HDFC Regalia Gold Credit Card', 'HDFC Bank', 'Visa', 'credit',
    'Premium rewards, lounge access & travel benefits',
    '₹2,500 + GST', '₹2,500 + GST (waived on ₹4L spend)', 'Travel & premium lifestyle',
    ['4 reward points per ₹150 spent', '5X points on Nykaa, Myntra, Marriott, Reliance Digital',
     '12 domestic + 6 international lounge visits/year', '₹1,500 Marriott/Myntra vouchers on milestones',
     'Complimentary Swiggy One & MMICC membership'],
    ['Click "Apply Now" for HDFC Regalia Gold', 'Submit income & KYC documents',
     'Video verification', 'Premium card delivered on approval'],
    'Salaried ₹1L/month or ITR ₹12L/year', 'https://www.hdfcbank.com', 'https://www.youtube.com/watch?v=regaliagold', 0, 6],

  ['bc_amex_mrcc', 'American Express Membership Rewards Card', 'Amex', 'Amex', 'credit',
    'Bonus reward points & premium service',
    '₹1,000 (first year)', '₹4,500 + GST', 'Reward points collectors',
    ['1,000 bonus points monthly on 4 transactions of ₹1,500+', '18-24k bonus points on annual milestones',
     'Reward Multiplier portal for extra points', 'Amex Offers with cashback & vouchers'],
    ['Click "Apply Now" for American Express', 'Fill detailed income & employment info',
     'Document verification by Amex', 'Card issued to eligible applicants'],
    'Salaried/self-employed, income ₹4.5L/year, good CIBIL', 'https://www.americanexpress.com/in', 'https://www.youtube.com/watch?v=amexmrcc', 0, 7],

  ['bc_kotak_811', 'Kotak 811 #DreamDifferent Credit Card', 'Kotak Bank', 'RuPay', 'credit',
    'Lifetime free entry-level card with reward points',
    'Lifetime FREE', 'Lifetime FREE', 'First-time card users',
    ['Lifetime free, no annual fee', '2 reward points per ₹100 spent', '2X points on all online spends',
     'RuPay UPI linkage — pay via UPI with your credit card', '1% fuel surcharge waiver'],
    ['Click "Apply Now" for Kotak 811', 'Open/link your Kotak 811 account',
     'Complete video KYC', 'Virtual card issued instantly'],
    'Existing Kotak 811 account holders', 'https://www.kotak.com', 'https://www.youtube.com/watch?v=kotak811', 0, 8],
];

// ── Bank / card / UPI offers (the differentiator) ─────────────────────────────
// [id, bank, instrument, title, type, value, maxCap, minOrder, storeId(null=all), promoCode, validDays, cardId(null)]
const BANK_OFFERS = [
  ['bo_hdfc_amz',  'HDFC Bank',  'credit', '10% instant discount on Amazon',          'percent', 10, 1500, 5000,  'st_amazon',   null,        9,  'bc_hdfc_millennia'],
  ['bo_icici_fk',  'ICICI Bank', 'credit', '10% off on Flipkart with ICICI cards',    'percent', 10, 1000, 4990,  'st_flipkart', null,        7,  'bc_icici_amazonpay'],
  ['bo_sbi_fk',    'SBI',        'debit',  '5% off on Flipkart with SBI debit cards', 'percent', 5,  750,  2990,  'st_flipkart', null,        7,  'bc_sbi_cashback'],
  ['bo_axis_myn',  'Axis Bank',  'credit', '₹300 off on Myntra above ₹2,499',         'flat',    300, null, 2499, 'st_myntra',   'AXIS300',   12, 'bc_axis_flipkart'],
  ['bo_kotak_nyk', 'Kotak Bank', 'credit', '15% off on Nykaa (max ₹400)',             'percent', 15, 400,  1499,  'st_nykaa',    'KOTAK15',   10, 'bc_kotak_811'],
  ['bo_hdfc_croma','HDFC Bank',  'emi',    '₹2,000 off on Croma with HDFC EMI',       'flat',    2000, null, 25000,'st_croma',    null,        20, 'bc_hdfc_regalia'],
  ['bo_icici_mmt', 'ICICI Bank', 'credit', '12% off on MakeMyTrip flights',           'percent', 12, 1800, 4500,  'st_mmt',      'ICICIFLY',  15, 'bc_icici_amazonpay'],
  ['bo_paytm_upi', 'Paytm UPI',  'upi',    'Flat ₹50 cashback via Paytm UPI',         'flat',    50,  null, 299,   null,          null,        30, null],
  ['bo_gpay_upi',  'Google Pay', 'upi',    '₹75 scratch reward on GPay UPI',          'flat',    75,  null, 499,   null,          null,        30, null],
  ['bo_amex_all',  'Amex',       'credit', '5% back on weekend spends (max ₹500)',    'percent', 5,  500,  1000,  null,          null,        6,  'bc_amex_mrcc'],
  ['bo_sbi_zom',   'SBI',        'credit', '20% off on Zomato (max ₹120)',            'percent', 20, 120,  249,   'st_zomato',   'ZOMSBI',    8,  'bc_sbi_cashback'],
  ['bo_axis_swig', 'Axis Bank',  'credit', '15% off on Swiggy (max ₹150)',            'percent', 15, 150,  399,   'st_swiggy',   'AXISWIG',   8,  'bc_axis_ace'],
];

// ── Deals ─────────────────────────────────────────────────────────────────────
// [id, storeId, title, category, mrp, price, code, badge, trending, expiryDays, path, desc]
const DEALS = [
  ['dl_01', 'st_amazon',   'boAt Airdopes 141 TWS Earbuds (42H Playback)',        'electronics',   4490,  1099,  null,       'LOOT', 1, 2,  '/boat-airdopes-141',
   'Bestselling TWS earbuds with ENx tech, low-latency gaming mode and 42-hour total playback.'],
  ['dl_02', 'st_flipkart', 'Samsung Galaxy M35 5G (8GB/128GB)',                   'mobiles',       24999, 16499, null,       'HOT',  1, 3,  '/samsung-galaxy-m35',
   '6000mAh battery, sAMOLED 120Hz display, 4 OS updates promised. Great mid-ranger at this price.'],
  ['dl_03', 'st_myntra',   'PUMA, Nike & adidas Sneakers — Min 55% OFF',          'footwear',      7999,  3599,  null,       'SALE', 1, 4,  '/sneaker-sale',
   'End of season sneaker bonanza across top brands, all sizes in stock.'],
  ['dl_04', 'st_amazon',   'Fire-Boltt Ninja Call Pro Smartwatch',                'watches',       4999,  1299,  null,       'LOOT', 1, 2,  '/fire-boltt-ninja',
   'Bluetooth calling smartwatch with 1.83" display and 100+ sports modes at an all-time-low price.'],
  ['dl_05', 'st_nykaa',    'Nykaa Pink Friday: Top Beauty Minis under ₹299',      'beauty',        999,   299,   'PINKMINI', 'NEW',  0, 6,  '/pink-friday-minis',
   'Travel-size bestsellers from Maybelline, Lakmé, MAC & more.'],
  ['dl_06', 'st_zomato',   'Zomato Gold 3-Month Membership at ₹99',               'food-dining',   399,   99,    'GOLD99',   'HOT',  1, 5,  '/gold-membership',
   'Free delivery + up to 30% off dining. Pays for itself in one order.'],
  ['dl_07', 'st_croma',    'LG 55" 4K UHD Smart TV (2026 model)',                 'tv-appliances', 74999, 42999, null,       'DEAL', 0, 8,  '/lg-55-uhd',
   'WebOS, Dolby Vision, 3 HDMI ports. Effective price drops further with HDFC EMI offer.'],
  ['dl_08', 'st_swiggy',   'Swiggy One 3-Month Membership at ₹149',               'food-dining',   499,   149,   null,       'NEW',  0, 7,  '/swiggy-one',
   'Unlimited free deliveries on food and Instamart above ₹149.'],
  ['dl_09', 'st_mmt',      'Goa Flights Sale: Delhi/Mumbai from ₹1,999',          'travel',        4500,  1999,  'GOFLY',    'SALE', 1, 10, '/goa-flights',
   'Limited-window fares on IndiGo & Akasa. Combine with ICICI card for 12% extra off.'],
  ['dl_10', 'st_bigbasket','Fortune Sunlite Oil 5L Pouch',                        'grocery',       975,   689,   null,       'DEAL', 0, 4,  '/fortune-oil-5l',
   'Household staple at its lowest price this quarter.'],
  ['dl_11', 'st_flipkart', 'Nothing Phone (3a) 5G (8GB/256GB)',                   'mobiles',       29999, 22999, null,       'HOT',  1, 5,  '/nothing-phone-3a',
   'Glyph interface, clean OS, 50MP main sensor — with card offer it beats every rival at this price.'],
  ['dl_12', 'st_ajio',     'AJIO Big Bold Sale: Flat 60-80% OFF',                 'fashion',       4999,  1499,  'BOLD60',   'SALE', 1, 6,  '/big-bold-sale',
   'Levi\'s, U.S. Polo, Puma and 4,000+ brands. Extra 10% off on first app order.'],
  ['dl_13', 'st_dominos',  'Two Medium Pizzas at ₹99 each (Wednesday only)',      'food-dining',   398,   198,   'WED99',    'LOOT', 1, 1,  '/wednesday-offer',
   'The classic Wednesday BOGO-beater. Valid on hand-tossed medium range.'],
  ['dl_14', 'st_amazon',   'Kindle Paperwhite (16GB, 2026 release)',              'electronics',   16999, 12999, null,       'DEAL', 0, 9,  '/kindle-paperwhite',
   'Waterproof, 300ppi, weeks of battery. Rarely discounted — grab it.'],
  ['dl_15', 'st_tatacliq', 'Titan & Fastrack Watches: Min 40% OFF',               'watches',       5995,  2999,  null,       'SALE', 0, 7,  '/watch-sale',
   'Authentic Titan-family brands with manufacturer warranty.'],
  ['dl_16', 'st_myntra',   'H&M & Zara Dresses under ₹1,299',                     'fashion',       3299,  1299,  null,       'NEW',  0, 5,  '/dresses-sale',
   'Fresh summer collection at clearance prices.'],
  ['dl_17', 'st_croma',    'Sony WH-CH720N Noise Cancelling Headphones',          'electronics',   14990, 8990,  null,       'DEAL', 0, 6,  '/sony-wh-ch720n',
   'Lightest full-size ANC in its class, 35-hour battery.'],
  ['dl_18', 'st_bigbasket','BB Royal Basmati Rice 10kg',                          'grocery',       1450,  999,   'BBRICE',   'DEAL', 0, 5,  '/basmati-10kg',
   'Aged basmati, bulk pack. Stack Paytm UPI cashback on top.'],
  ['dl_19', 'st_reliance', 'Daikin 1.5 Ton 5-Star Inverter Split AC',             'tv-appliances', 62990, 41990, null,       'DEAL', 1, 12, '/daikin-15t-5star',
   'Copper condenser, PM 2.5 filter, triple display. Best-in-class cooling for Indian summers.'],
  ['dl_20', 'st_flipkart', 'LG 8kg 5-Star Fully Automatic Front Load Washer',     'tv-appliances', 42990, 31990, null,       'HOT',  1, 9,  '/lg-8kg-frontload',
   'AI Direct Drive, steam wash, 10-year motor warranty.'],
  ['dl_21', 'st_amazon',   'Apple iPhone 15 (128GB)',                             'mobiles',       69900, 57999, null,       'HOT',  1, 6,  '/iphone-15-128',
   'A16 Bionic, 48MP camera, USB-C. Lowest price yet — stacks with HDFC card offer.'],
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

// ── Buying guides ("Best X") ──────────────────────────────────────────────────
// guide: [id, title, categorySlug, subtitle, intro, videoUrl, sort]
// items: [rank, name, price, award, features[], pros[], cons[], whyChoose, buyUrl, videoUrl]
const GUIDES = [
  {
    g: ['gd_ac', 'Best Air Conditioners in India (2026)', 'tv-appliances',
        'Top 1.5-ton inverter split ACs for Indian summers',
        'We tested cooling speed, power bills, noise and after-sales across the top-selling ACs. Here are the three worth your money — and exactly who each one is for.',
        'https://www.youtube.com/watch?v=best-ac-2026', 1],
    items: [
      [1, 'Daikin 1.5 Ton 5-Star Inverter Split AC', 41990, 'Best Overall',
        ['5-star ISEER 4.7', 'Copper condenser', 'PM 2.5 filter', 'Coanda airflow'],
        ['Lowest running cost in class', 'Very quiet at night', 'Excellent Daikin service network'],
        ['Premium price', 'No Wi-Fi control'],
        'If you run the AC 6+ hours daily, Daikin\'s efficiency pays back the extra cost within two summers, and its service network is the most reliable in India.',
        'https://www.amazon.in', 'https://www.youtube.com/watch?v=daikin-review'],
      [2, 'LG 1.5 Ton 5-Star AI Dual Inverter AC', 38490, 'Best Smart Features',
        ['AI Convertible 6-in-1', 'Wi-Fi + voice control', 'Anti-virus HD filter', '4-way swing'],
        ['Great value for features', 'Convertible mode saves power', 'Fast cooling'],
        ['Slightly louder than Daikin', 'Filter cleaning every 15 days'],
        'Pick this if you want app/voice control and convertible cooling modes without paying the Daikin premium.',
        'https://www.flipkart.com', 'https://www.youtube.com/watch?v=lg-ac-review'],
      [3, 'Lloyd 1.5 Ton 3-Star Inverter Split AC', 31990, 'Best Budget',
        ['3-star inverter', 'Copper condenser', 'Turbo cool', 'Anti-corrosive coating'],
        ['Lowest upfront price', 'Solid cooling', 'Good for moderate use'],
        ['Higher power bill than 5-star', 'Basic filtration'],
        'For a bedroom used only at night or in milder climates, the lower sticker price beats the small extra running cost of a 3-star unit.',
        'https://www.amazon.in', 'https://www.youtube.com/watch?v=lloyd-ac-review'],
    ]
  },
  {
    g: ['gd_tv', 'Best 55-inch 4K Smart TVs in India (2026)', 'tv-appliances',
        'Big-screen picks for movies, gaming and everyday streaming',
        'A 55-inch 4K TV is the sweet spot for most Indian living rooms. We compared panel quality, brightness, gaming lag and smart-OS smoothness to shortlist these three.',
        'https://www.youtube.com/watch?v=best-tv-2026', 2],
    items: [
      [1, 'Sony Bravia 55" 4K Google TV', 79990, 'Best Picture',
        ['4K X-Reality PRO', 'Dolby Vision + Atmos', 'Google TV', '2 HDMI 2.1'],
        ['Reference-grade picture', 'Excellent upscaling', 'Great built-in speakers'],
        ['Priciest option', 'Only 2 HDMI 2.1 ports'],
        'If picture quality matters most and you watch a lot of movies, Sony\'s processing is a visible step above everything else at 55 inches.',
        'https://www.amazon.in', 'https://www.youtube.com/watch?v=sony-tv-review'],
      [2, 'LG 55" 4K UHD Smart TV', 42999, 'Best Value',
        ['WebOS', 'Dolby Vision', '3 HDMI', 'Filmmaker Mode'],
        ['Best balance of price & quality', 'Snappy WebOS', 'Good HDR'],
        ['Average built-in sound', 'Peak brightness is modest'],
        'The all-rounder most people should buy — 90% of the Sony experience at roughly half the price, and it stacks further with the HDFC EMI card offer.',
        'https://www.croma.com', 'https://www.youtube.com/watch?v=lg-tv-review'],
      [3, 'TCL 55" QLED 4K Gaming TV', 36990, 'Best for Gaming',
        ['QLED panel', '144Hz VRR', 'Game Master mode', 'Dolby Vision + Atmos'],
        ['144Hz for PC/console gaming', 'Punchy QLED colours', 'Lowest price here'],
        ['Weaker motion handling', 'Smart OS occasionally laggy'],
        'For a PS5/PC gamer chasing high refresh rates on a budget, the 144Hz QLED panel is unbeatable value at this size.',
        'https://www.flipkart.com', 'https://www.youtube.com/watch?v=tcl-tv-review'],
    ]
  },
  {
    g: ['gd_phone', 'Best Smartphones under ₹25,000 (2026)', 'mobiles',
        'Flagship-killer value picks tested for camera, battery & performance',
        'Under ₹25,000 the competition is brutal. We ranked these on real-world camera quality, battery life, software updates and gaming — so you don\'t overpay for the wrong one.',
        'https://www.youtube.com/watch?v=best-phone-25k', 3],
    items: [
      [1, 'Nothing Phone (3a) 5G (8GB/256GB)', 22999, 'Best Overall',
        ['Snapdragon 7-series', '50MP main + telephoto', '120Hz AMOLED', 'Clean Nothing OS'],
        ['Cleanest software + long updates', 'Versatile triple camera', 'Unique design'],
        ['No wireless charging', 'Average low-light video'],
        'The best mix of camera, clean software and update longevity in this bracket — and with the ICICI Flipkart offer it dips even lower.',
        'https://www.flipkart.com', 'https://www.youtube.com/watch?v=nothing-3a-review'],
      [2, 'Samsung Galaxy M35 5G (8GB/128GB)', 16499, 'Best Battery',
        ['6000mAh battery', 'sAMOLED 120Hz', '4 OS updates', 'Exynos 1380'],
        ['Two-day battery life', 'Bright sAMOLED display', 'Long software support'],
        ['Slippery plastic back', 'Bloatware out of box'],
        'If battery life and a long update promise matter more than raw speed, the M35 is the safe, cheap pick.',
        'https://www.amazon.in', 'https://www.youtube.com/watch?v=m35-review'],
      [3, 'iQOO Z9 Turbo 5G (8GB/256GB)', 24999, 'Best Performance',
        ['Snapdragon 8s Gen 3', '6000mAh + 80W charging', '144Hz AMOLED', 'LPDDR5X'],
        ['Flagship-class gaming', 'Very fast charging', 'Great display'],
        ['Camera trails rivals', 'Gets warm under load'],
        'For a mobile gamer, nothing else near ₹25k comes close to this chipset — buy it if frame rates beat photography for you.',
        'https://www.amazon.in', 'https://www.youtube.com/watch?v=z9turbo-review'],
    ]
  },
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

  for (const [id, name, bank, network, type, tagline, jFee, aFee, bestFor, benefits, steps, elig, applyUrl, videoUrl, featured, sort] of BANK_CARDS) {
    await query(`
      INSERT IGNORE INTO bank_cards
        (id, slug, name, bank, network, card_type, image_url, tagline, joining_fee, annual_fee, best_for,
         benefits, how_to_apply, eligibility, apply_url, video_url, is_featured, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, slugify(name), name, bank, network, type, img(id), tagline, jFee, aFee, bestFor,
        J(benefits), J(steps), elig, applyUrl, videoUrl, featured, sort]);
  }

  for (const [id, bank, instrument, title, type, value, cap, minOrder, storeId, code, validDays, cardId] of BANK_OFFERS) {
    await query(`
      INSERT IGNORE INTO bank_offers
        (id, bank, instrument, title, description, discount_type, discount_value, max_discount, min_order,
         store_id, bank_card_id, promo_code, valid_from, valid_till, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, bank, instrument, title,
        `${title}. Automatically applied at payment${code ? ` with code ${code}` : ''}. T&Cs apply.`,
        type, value, cap, minOrder, storeId, cardId, code, today(), day(validDays)]);
  }

  for (const [id, storeId, title, cat, mrp, price, code, badge, trending, expiryDays, path, desc] of DEALS) {
    const store = STORES.find(s => s[0] === storeId);
    const howTo = J([
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

  for (const { g, items } of GUIDES) {
    const [gid, gtitle, gcat, gsub, gintro, gvideo, gsort] = g;
    await query(`
      INSERT IGNORE INTO guides (id, slug, title, category, subtitle, intro, hero_image, video_url, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [gid, slugify(gtitle), gtitle, gcat, gsub, gintro, img(gid), gvideo, gsort]);
    for (const [rank, name, price, award, features, pros, cons, why, buyUrl, videoUrl] of items) {
      await query(`
        INSERT IGNORE INTO guide_items
          (id, guide_id, rank_no, name, image_url, price, award, features, pros, cons, why_choose, video_url, buy_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [`${gid}_i${rank}`, gid, rank, name, img(`${gid}_${rank}`), price, award,
          J(features), J(pros), J(cons), why, videoUrl, buyUrl]);
    }
  }

  const counts = {};
  for (const t of ['stores', 'deals', 'bank_offers', 'bank_cards', 'guides', 'guide_items', 'coupons', 'admins']) {
    counts[t] = (await query(`SELECT COUNT(*) AS c FROM ${t}`))[0].c;
  }
  console.log('[Seed] totals:', counts);
  console.log('[Seed] admin: admin@indiaoffers.in / admin123');
  process.exit(0);
}

seed().catch(err => { console.error('[Seed] failed:', err); process.exit(1); });
