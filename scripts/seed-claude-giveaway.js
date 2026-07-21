'use strict';

/**
 * Seeds the GetUsers.online "Claude Pro membership giveaway" listing.
 *
 *   node scripts/seed-claude-giveaway.js          # insert / update
 *   node scripts/seed-claude-giveaway.js --dry    # print what would change
 *
 * Re-runnable: matches on the deal slug and updates in place, so editing the
 * copy below and re-running is the intended way to revise the listing.
 *
 * ── Why this deal carries no `price` ────────────────────────────────────────
 * The prize is drawn, not sold. src/routes/pages.js only emits Product+Offer
 * JSON-LD when `price != null`, so leaving price NULL is what keeps us from
 * telling Google a lottery is a ₹0 purchase — that is spammy structured data
 * under Google's own policy and risks a site-wide manual action. Do not "fix"
 * this by setting price = 0.
 *
 * Honours DB_DRIVER (.env): sqlite locally, mysql in production.
 */

const db = require('../src/db');

const DRY = process.argv.includes('--dry');

// ── Edit these before the giveaway opens ────────────────────────────────────
// Must match the giveaway slug seeded by getusers/prisma/seed-claude-giveaway.mjs
const ENTRY_URL   = 'https://getusers.online/giveaways/claude-pro-membership-giveaway';
const CLOSES_ON   = '2026-08-31';   // last day to enter; also the deal's expiry
const DRAW_ON     = '2026-09-02';   // winners drawn + announced
// One winner, not several. The GetUsers draw endpoint picks a single weighted-
// random winner and 409s if one already exists, so it physically cannot award
// more. Raising this number would put a promise on the page that the platform
// running the draw can't keep — run separate giveaways instead.
const WINNERS     = 1;
const PRIZE       = '1-month Claude Pro gift subscription (₹2,399 value)';

const STORE = {
  id:          'st_getusers',
  slug:        'getusers-online',
  name:        'GetUsers.online',
  color:       '#6d28d9',
  category:    'ai-tools',
  website_url: 'https://getusers.online',
  description: 'GetUsers.online runs growth campaigns and periodic subscription giveaways for Indian users.'
};

const SLUG = 'claude-pro-membership-giveaway-india';

const TITLE = `Free Claude Pro Membership Giveaway — Win a Claude Pro Subscription Worth ₹2,399 (India)`;

// Plain text. richText() escapes it and turns blank lines into <p> blocks, so
// no HTML here. This is the body Google reads for topical relevance — it has to
// answer the query ("can I get Claude Pro free in India?") honestly, not just
// pitch the giveaway.
const DESCRIPTION = `GetUsers.online is running a Claude Pro giveaway for users in India. One winner receives a ${PRIZE}, delivered as an official Anthropic gift subscription code. Entry is free and closes on ${CLOSES_ON}; the winner is drawn on ${DRAW_ON}.

This is a prize draw, not a discount. Entering does not guarantee a subscription — one entrant wins, everyone else does not. Anyone advertising a guaranteed "free Claude Pro account" is almost certainly phishing for your login.

What Claude Pro actually costs in India

Anthropic moved Claude to rupee billing in July 2026. Claude Pro is ₹2,399 per month, or roughly ₹2,000 per month if you pay annually. Claude Max 5x is ₹11,999 per month and Max 20x is ₹23,999 per month. Prices shown include taxes. Payment currently requires a credit or debit card — UPI is not supported yet.

If you do not win, Claude still has a genuine free tier at claude.ai with no payment details required. It has lower usage limits than Pro but is a real, permanent free plan — not a trial.

How the prize is delivered

The winner receives an Anthropic gift subscription code. Anthropic launched official Claude gift subscriptions in December 2025 at claude.ai/gift, covering Pro, Max 5x and Max 20x. Codes are redeemed on the winner's own Claude account, so you keep full control of it — no shared logins, no credentials handed around. Gift codes expire 365 days after purchase, and a recipient cannot stack multiple gift redemptions at the same time.

Terms

Open to residents of India aged 18 or over. One entry per person; duplicate or automated entries are disqualified. The winner is selected at random from all valid entries on ${DRAW_ON} and contacted on the email address used to enter. If the winner does not respond within 7 days, a replacement is drawn. No cash alternative. The promoter is GetUsers.online.

This giveaway is run by GetUsers.online and listed by IndiaOffers.in. It is not sponsored, endorsed, administered by, or associated with Anthropic. Claude and Anthropic are trademarks of Anthropic PBC, used here only to identify the prize.`;

// Mirrors the four tasks seeded in getusers/prisma/seed-claude-giveaway.mjs.
// Keep the entry counts in sync with that file — they are shown to entrants on
// both sites and a mismatch reads as a bait-and-switch.
const HOW_TO = [
  `Sign up or log in at GetUsers.online — entry is free and takes about a minute.`,
  `Sign up on Mivloc and start one encrypted chat, then submit your registered email to claim 5 entries.`,
  `Sign up on QuickCric and simulate at least two matches, then submit your username for 5 entries.`,
  `Visit TrulyVeg and read one ingredient guide — 45 seconds on the page auto-credits 1 entry.`,
  `Register on IndiaOffers for 3 entries. That is 14 entries in total; every entry is one ticket in the draw.`,
  `Entries close on ${CLOSES_ON}. One winner is drawn at random on ${DRAW_ON} and emailed an Anthropic gift subscription code, redeemed on your own Claude account at claude.ai/redeem.`
];

(async () => {
  // ── Store ────────────────────────────────────────────────────────────────
  const existingStore = await db.query('SELECT id FROM stores WHERE slug = ?', [STORE.slug]);
  if (existingStore.length === 0) {
    if (!DRY) {
      await db.query(`
        INSERT INTO stores (id, slug, name, color, category, description, website_url, affiliate_type, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'none', 1)
      `, [STORE.id, STORE.slug, STORE.name, STORE.color, STORE.category, STORE.description, STORE.website_url]);
    }
    console.log(`${DRY ? '[dry-run] would create' : 'Created'} store ${STORE.slug}`);
  } else {
    console.log(`Store ${STORE.slug} already exists (${existingStore[0].id})`);
  }
  const storeId = existingStore.length ? existingStore[0].id : STORE.id;

  // ── Deal ─────────────────────────────────────────────────────────────────
  const existingDeal = await db.query('SELECT id FROM deals WHERE slug = ?', [SLUG]);
  const howTo = JSON.stringify(HOW_TO);
  // Comma-wrapped so `LIKE '%,slug,%'` stays exact, matching backfill-categories.
  const seoCats = ',ai-tools,entertainment,';

  if (existingDeal.length) {
    if (!DRY) {
      await db.query(`
        UPDATE deals SET title = ?, description = ?, category = ?, seo_categories = ?,
          deal_url = ?, how_to = ?, badge = ?, expiry_date = ?, is_active = 1,
          price = NULL, mrp = NULL, verified_at = NOW(), updated_at = NOW()
        WHERE slug = ?
      `, [TITLE, DESCRIPTION, 'ai-tools', seoCats, ENTRY_URL, howTo, 'GIVEAWAY', CLOSES_ON, SLUG]);
    }
    console.log(`${DRY ? '[dry-run] would update' : 'Updated'} deal ${SLUG} (${existingDeal[0].id})`);
  } else {
    if (!DRY) {
      await db.query(`
        INSERT INTO deals (id, slug, store_id, title, description, category, seo_categories,
          image_url, mrp, price, coupon_code, deal_url, how_to, badge, cashback_text,
          is_trending, hotness, is_active, expiry_date, verified_at, posted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, NULL, 1, 5, 1, ?, NOW(), NOW())
      `, [db.uid('dl'), SLUG, storeId, TITLE, DESCRIPTION, 'ai-tools', seoCats,
          ENTRY_URL, howTo, 'GIVEAWAY', CLOSES_ON]);
    }
    console.log(`${DRY ? '[dry-run] would create' : 'Created'} deal ${SLUG}`);
  }

  console.log(`\n→ /deal/${SLUG}`);
  console.log(`→ /category/ai-tools`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
