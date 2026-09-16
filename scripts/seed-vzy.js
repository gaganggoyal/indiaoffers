'use strict';

/**
 * Seeds the Vzy AI website builder listing (store + deal).
 *
 *   node scripts/seed-vzy.js          # insert / update
 *   node scripts/seed-vzy.js --dry    # print what would change
 *
 * Re-runnable: matches on the store slug and the deal slug and updates in
 * place, so editing the copy below and re-running is the intended way to
 * revise the listing.
 *
 * ── Why this deal carries no `price` ────────────────────────────────────────
 * Vzy bills in USD and fmt() renders every price as ₹. A "$10" shown as "₹10"
 * would be a lie on the page and in the Product+Offer JSON-LD (only emitted
 * when price != null). Pricing is spelled out in the description instead.
 * Do not "fix" this by converting to rupees — the rate moves and the card
 * markup varies by bank.
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

// ── Edit these when Vzy changes its pricing page ────────────────────────────
// Affiliate short link; resolves via linkredirect.in to vzy.co. Used for both
// the deal CTA (/go/d) and the store's "Visit store" button (/go/s).
const AFFILIATE_URL = 'https://bitli.in/K2ngu4C';
// Checked against https://vzy.co/pricing on 16 September 2026.
const BASIC_MONTHLY = 15, BASIC_YEARLY = 10;   // USD per month
const PRO_MONTHLY   = 35, PRO_YEARLY   = 25;   // USD per month
// Evergreen listing: the daily refresh rolls this forward on its own, so the
// date only marks when the pricing above was last confirmed.
const REVIEW_ON = '2026-12-31';

const STORE = {
  id:          'st_vzy',
  slug:        'vzy',
  name:        'Vzy',
  color:       '#111111',
  category:    'ai-tools',
  website_url: 'https://vzy.co',
  description: 'Vzy is an AI website builder: describe your business and it generates a complete site — copy, images, sections, forms and SEO — that you edit and publish from a phone or desktop. Hosting and a built-in CRM are included on every plan.'
};

const SLUG = 'vzy-ai-website-builder-free-plan-india';

const TITLE = `Vzy AI Website Builder — Build & Publish a Website Free in Minutes, Paid Plans from $${BASIC_YEARLY}/month on Annual Billing`;

// Plain text. richText() escapes it and turns blank lines into <p> blocks, so
// no HTML here. This is the body Google reads for topical relevance — it has to
// answer the query ("is Vzy free? what does it cost in India?") honestly, not
// just pitch the tool.
const DESCRIPTION = `Vzy is an AI website builder aimed at freelancers, solopreneurs and small businesses that need a professional site without hiring a designer. You describe your business in a sentence or two, and Vzy generates a complete website — headline, copy, images, sections, a contact form and SEO tags — in about two minutes. You then edit it in a no-code editor that works in a mobile or desktop browser and publish with one click.

There is a genuine free plan. No card is needed, it does not expire, and it is enough to put a real one-page or three-page site online today.

What the free plan includes

One website on a vzy.io subdomain, up to 3 pages, up to 100 contacts saved from your forms, Vzy hosting on AWS with Cloudflare CDN, and the same AI generator and editor as the paid plans. The trade-offs: a small "Made with Vzy" badge on the site, and no custom domain.

What the paid plans cost

Vzy bills in US dollars. Basic Site is $${BASIC_MONTHLY} per month, or $${BASIC_YEARLY} per month when paid annually — a custom domain, up to 100 pages, 1,000 contacts, 1 GB storage and no Vzy branding. Pro Site is $${PRO_MONTHLY} per month, or $${PRO_YEARLY} per month annually — unlimited pages and contacts, 10 GB storage, custom code and the ability to export your site. Annual billing is the real discount here: it takes 29–33% off the monthly rate. Pay with an international-enabled credit or debit card; your bank may add a 2–3.5% forex markup on top, and UPI is not accepted.

Two more discounts are worth knowing about. Students get 50% off by emailing hey@vzy.co from a college or .edu address, and registered non-profits get 50% off with proof of registration.

Who it is and is not for

Vzy is built for speed over flexibility. It is a strong fit for a portfolio, a landing page, a clinic, salon, coaching or consultancy site, or a "link in bio" page with a working contact form and CRM behind it. It is not a fit if you need an online store, a blog with categories and comments, or deep design control — there are only a handful of templates, no e-commerce, no blogging module and no third-party app marketplace. For those, look at Wix, Shopify or WordPress instead.

Every plan includes the AI generator, the no-code editor, fast hosting, unlimited page views, themes with dark mode, email sign-ups, built-in analytics, a mobile editor with auto-save, and 1,000+ fonts and icons.

Vzy is a product of Vzy, Inc. Pricing above was checked on Vzy's own pricing page and is shown in the currency Vzy charges; confirm the current rate at checkout before you subscribe.`;

// Steps shown after the automatic "Click Grab this deal at Vzy" first step.
const HOW_TO = [
  `Sign up with Google or an email address — no card is needed for the free plan.`,
  `Describe your business in a sentence or two. Vzy's AI builds the full site — copy, images, sections, a contact form and SEO tags — in about two minutes.`,
  `Edit text, images and sections in the no-code editor (it works on your phone too), then press Publish. On the free plan your site goes live on a vzy.io subdomain with up to 3 pages and 100 CRM contacts.`,
  `Want a custom domain, no Vzy badge or more pages? Upgrade to Basic ($${BASIC_MONTHLY}/month, or $${BASIC_YEARLY}/month billed annually) or Pro ($${PRO_MONTHLY}/month, or $${PRO_YEARLY}/month annually). Pick yearly billing at checkout — that is where the 29–33% saving is.`,
  `Students: email hey@vzy.co from your college or .edu address for 50% off. Registered non-profits get 50% off with proof.`
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

  // ── Deal ─────────────────────────────────────────────────────────────────
  const existingDeal = await db.query('SELECT id FROM deals WHERE slug = ?', [SLUG]);
  const howTo = JSON.stringify(HOW_TO);
  const image = '/uploads/vzy-ai-website-builder.jpg';
  // Comma-wrapped so `LIKE '%,slug,%'` stays exact, matching backfill-categories.
  const seoCats = ',ai-tools,';

  if (existingDeal.length) {
    if (!DRY) {
      await db.query(`
        UPDATE deals SET store_id = ?, title = ?, description = ?, category = ?, seo_categories = ?,
          image_url = ?, deal_url = ?, how_to = ?, badge = ?, expiry_date = ?,
          price = NULL, mrp = NULL, true_price = NULL, coupon_code = NULL, cashback_text = NULL,
          is_active = 1, verified_at = NOW(), updated_at = NOW()
        WHERE slug = ?
      `, [storeId, TITLE, DESCRIPTION, 'ai-tools', seoCats, image, AFFILIATE_URL, howTo,
          'NEW', REVIEW_ON, SLUG]);
    }
    console.log(`${DRY ? '[dry-run] would update' : 'Updated'} deal ${SLUG} (${existingDeal[0].id})`);
  } else {
    if (!DRY) {
      await db.query(`
        INSERT INTO deals (id, slug, store_id, title, description, category, seo_categories,
          image_url, mrp, price, coupon_code, deal_url, how_to, badge, cashback_text,
          is_trending, hotness, is_active, expiry_date, verified_at, posted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, NULL, 1, 5, 1, ?, NOW(), NOW())
      `, [db.uid('dl'), SLUG, storeId, TITLE, DESCRIPTION, 'ai-tools', seoCats,
          image, AFFILIATE_URL, howTo, 'NEW', REVIEW_ON]);
    }
    console.log(`${DRY ? '[dry-run] would create' : 'Created'} deal ${SLUG}`);
  }

  console.log(`\n→ /deal/${SLUG}`);
  console.log(`→ /store/${STORE.slug}`);
  console.log(`→ /category/ai-tools`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
