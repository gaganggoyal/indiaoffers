'use strict';

/**
 * Seeds the VZY OTT super-app listing (store + deal).
 *
 *   node scripts/seed-vzy.js          # insert / update
 *   node scripts/seed-vzy.js --dry    # print what would change
 *
 * VZY (vzy.one) is Dish TV India's streaming app — 29+ OTT apps under one
 * login plus live TV — launched 20 May 2026 as the successor to Watcho. Not to
 * be confused with vzy.co, an unrelated US website builder.
 *
 * Re-runnable: matches on the store slug and the deal slug and updates in
 * place, so editing the copy below and re-running is the intended way to
 * revise the listing. Slugs listed in LEGACY_SLUGS are renamed to SLUG first,
 * so a retitled deal keeps its id (and therefore its /go/d link and clicks).
 *
 * ── Why this deal carries no `price` ────────────────────────────────────────
 * VZY sells several plans (OTT vs live TV, 1/3/12 months) and the line-up
 * differs per plan, so there is no single number that is "the price". A bare
 * "₹169" in the price block — and in Product+Offer JSON-LD, which pages.js
 * emits whenever price != null — would overstate what we can verify. Pricing
 * lives in the description with a "check the plan screen" caveat instead.
 *
 * ── No cashback / rewards ───────────────────────────────────────────────────
 * This is a plain affiliate referral. cashback_text stays NULL on both the
 * store and the deal, and no savings_rows are attached, so the page shows no
 * "IO rewards" chip and no pay-with-X breakdown.
 *
 * Honours DB_DRIVER (.env): sqlite locally, mysql in production.
 */

const db = require('../src/db');

const DRY = process.argv.includes('--dry');

// ── Edit these when VZY changes its plans ───────────────────────────────────
// Affiliate short link; resolves via linkredirect.in to VZY. Used for both
// the deal CTA (/go/d) and the store's "Visit store" button (/go/s).
const AFFILIATE_URL = 'https://bitli.in/K2ngu4C';
// OTT "from" price is the one VZY advertises in the current campaign; live TV
// plans are from VZY's July 2026 announcement.
const CHECKED_ON    = '16 September 2026';
const OTT_FROM      = 169;                        // ₹ per month, OTT plans
const LIVE_TV       = { m1: 179, m3: 499, m12: 1849 }; // ₹, 200+ live channels
const APP_COUNT     = '29+';
// Evergreen listing: the daily refresh rolls this forward on its own, so the
// date only marks when the facts above were last confirmed.
const REVIEW_ON = '2026-12-31';

const STORE = {
  id:          'st_vzy',
  slug:        'vzy',
  name:        'VZY',
  color:       '#fdb913',
  category:    'entertainment',
  website_url: 'https://www.vzy.one',
  description: 'VZY is Dish TV India\'s streaming super-app: 29+ OTT platforms (JioHotstar, SonyLIV, ZEE5, MX Player, Lionsgate Play, Sun NXT, Aha, hoichoi and more), 110+ live TV channels and 2 lakh+ titles behind one login and one subscription, on mobile, Smart TV, Fire TV Stick and the web.'
};

const SLUG = 'vzy-ott-subscription-29-apps-one-login-india';
// Earlier slug(s) this listing was published under; renamed in place.
const LEGACY_SLUGS = ['vzy-ai-website-builder-free-plan-india'];

const TITLE = `VZY OTT Subscription — ${APP_COUNT} OTT Apps (JioHotstar, SonyLIV, ZEE5, MX Player & More) in One App from ₹${OTT_FROM}/Month`;

// Plain text. richText() escapes it and turns blank lines into <p> blocks, so
// no HTML here. This is the body Google reads for topical relevance — it has to
// answer the query ("what is VZY, what does it include, what does it cost?")
// honestly, not just pitch the app.
const DESCRIPTION = `VZY is Dish TV India's OTT super-app. Instead of paying for and juggling a dozen streaming apps, you take one VZY plan and get ${APP_COUNT} OTT platforms under a single login — one bill, one renewal date, one search box across all of them. It launched on 20 May 2026 and replaces Dish TV's earlier Watcho app; Watcho subscribers have been moved across.

What you get

The current line-up is MX Player, JioHotstar, SonyLIV, ZEE5, Chaupal, Lionsgate Play, Sun NXT, Discovery Plus, Aha, Fliqs, hoichoi, FanCode, Hungama, ShemarooMe, ShortsTV, Stage, JOJO, Playflix, Tarang Plus, Times Play, Sanskar, NammaFlix and more — over 2 lakh titles across Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Punjabi, Odia and Marathi. Universal search finds a title across every partner app, and a watchlist, separate profiles, offline downloads and parental controls work across the whole bundle. There are also 110+ live TV channels and 2,000+ hours of free movies and series that stream without any plan at all.

Two things VZY does not include: Netflix and Amazon Prime Video are not part of the bundle. Which partner apps — and which tier of each — a given plan unlocks is listed on the plan screen inside the app; read it before you pay, because the line-up differs between plans and can change.

What it costs

VZY advertises OTT plans starting at ₹${OTT_FROM} a month, with 1-month, 3-month and 12-month options — the longer terms work out cheaper per month. Live TV is sold as a separate plan: ₹${LIVE_TV.m1} for 1 month, ₹${LIVE_TV.m3} for 3 months or ₹${LIVE_TV.m12.toLocaleString('en-IN')} for 12 months for 200+ channels across entertainment, movies, sports, news, kids, music, devotional and regional categories. You can take OTT only, live TV only, or both. Prices are those shown by VZY on ${CHECKED_ON}; the app's plan screen is the final word.

For comparison, the same apps bought separately run to several thousand rupees a year, so a bundle at this level is priced closer to a single premium OTT than to the sum of its parts. The catch is the same as with every aggregator: you are paying for breadth, and if you only ever watch one of these apps, its own annual plan may still be the better buy.

Where it works

Android phones and tablets, iPhone, Android TV and Google TV sets, LG webOS TVs, Amazon Fire TV Stick and any web browser at vzy.one. Sign in on a phone and the same profile, watchlist and progress follow you to the TV. VZY Smart TVs (Dish TV's own QLED range) ship with a 12-month VZY subscription bundled.

VZY is operated by Dish TV India Ltd. JioHotstar, SonyLIV, ZEE5 and the other platform names are trademarks of their respective owners and are listed here only to identify what the bundle contains.`;

// Steps shown after the automatic "Click Grab this deal at VZY" first step.
const HOW_TO = [
  `Click to grab deal — it opens VZY's offer page directly. Sign in there with your mobile number and OTP.`,
  `Try the free section first — 2,000+ hours of movies and series stream without any plan, so you can check the app on your device before paying.`,
  `Open Subscriptions and pick an OTT plan (1, 3 or 12 months; from ₹${OTT_FROM}/month). The plan screen lists exactly which of the ${APP_COUNT} apps it unlocks — read it before you pay. Live TV (200+ channels) is a separate plan at ₹${LIVE_TV.m1} / ₹${LIVE_TV.m3} / ₹${LIVE_TV.m12.toLocaleString('en-IN')} for 1 / 3 / 12 months.`,
  `Pay in the app. Partner apps unlock under the same VZY login — open them from inside VZY, no separate passwords to manage.`,
  `Already on Watcho? Your subscription has been migrated to VZY — sign in with the same mobile number.`
];

(async () => {
  // ── Store ────────────────────────────────────────────────────────────────
  const existingStore = await db.query('SELECT id FROM stores WHERE slug = ?', [STORE.slug]);
  if (existingStore.length === 0) {
    if (!DRY) {
      await db.query(`
        INSERT INTO stores (id, slug, name, color, category, description, website_url, affiliate_url,
          affiliate_type, cashback_text, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'none', NULL, 1)
      `, [STORE.id, STORE.slug, STORE.name, STORE.color, STORE.category, STORE.description,
          STORE.website_url, AFFILIATE_URL]);
    }
    console.log(`${DRY ? '[dry-run] would create' : 'Created'} store ${STORE.slug}`);
  } else {
    if (!DRY) {
      await db.query(`
        UPDATE stores SET name = ?, color = ?, category = ?, description = ?, website_url = ?,
          affiliate_url = ?, affiliate_type = 'none', cashback_text = NULL, is_active = 1
        WHERE slug = ?
      `, [STORE.name, STORE.color, STORE.category, STORE.description, STORE.website_url,
          AFFILIATE_URL, STORE.slug]);
    }
    console.log(`${DRY ? '[dry-run] would update' : 'Updated'} store ${STORE.slug} (${existingStore[0].id})`);
  }
  const storeId = existingStore.length ? existingStore[0].id : STORE.id;

  // ── Legacy slug rename ───────────────────────────────────────────────────
  // Only when the current slug is not already taken, so re-runs are no-ops.
  let existingDeal = await db.query('SELECT id FROM deals WHERE slug = ?', [SLUG]);
  if (existingDeal.length === 0) {
    for (const old of LEGACY_SLUGS) {
      const legacy = await db.query('SELECT id FROM deals WHERE slug = ?', [old]);
      if (legacy.length) {
        if (!DRY) await db.query('UPDATE deals SET slug = ? WHERE id = ?', [SLUG, legacy[0].id]);
        console.log(`${DRY ? '[dry-run] would rename' : 'Renamed'} ${old} → ${SLUG} (${legacy[0].id})`);
        existingDeal = legacy;
        break;
      }
    }
  }

  // ── Deal ─────────────────────────────────────────────────────────────────
  const howTo = JSON.stringify(HOW_TO);
  const image = '/uploads/vzy-ott-app.jpg';
  // Comma-wrapped so `LIKE '%,slug,%'` stays exact, matching backfill-categories.
  const seoCats = ',entertainment,';

  if (existingDeal.length) {
    if (!DRY) {
      await db.query(`
        UPDATE deals SET store_id = ?, title = ?, description = ?, category = ?, seo_categories = ?,
          image_url = ?, deal_url = ?, how_to = ?, badge = ?, expiry_date = ?,
          price = NULL, mrp = NULL, true_price = NULL, coupon_code = NULL, cashback_text = NULL,
          is_active = 1, verified_at = NOW(), updated_at = NOW()
        WHERE id = ?
      `, [storeId, TITLE, DESCRIPTION, 'entertainment', seoCats, image, AFFILIATE_URL, howTo,
          'NEW', REVIEW_ON, existingDeal[0].id]);
    }
    console.log(`${DRY ? '[dry-run] would update' : 'Updated'} deal ${SLUG} (${existingDeal[0].id})`);
  } else {
    if (!DRY) {
      await db.query(`
        INSERT INTO deals (id, slug, store_id, title, description, category, seo_categories,
          image_url, mrp, price, coupon_code, deal_url, how_to, badge, cashback_text,
          is_trending, hotness, is_active, expiry_date, verified_at, posted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, NULL, 1, 5, 1, ?, NOW(), NOW())
      `, [db.uid('dl'), SLUG, storeId, TITLE, DESCRIPTION, 'entertainment', seoCats,
          image, AFFILIATE_URL, howTo, 'NEW', REVIEW_ON]);
    }
    console.log(`${DRY ? '[dry-run] would create' : 'Created'} deal ${SLUG}`);
  }

  console.log(`\n→ /deal/${SLUG}`);
  console.log(`→ /store/${STORE.slug}`);
  console.log(`→ /category/entertainment`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
