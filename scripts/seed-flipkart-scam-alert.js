'use strict';

/**
 * Seeds the "fake Flipkart sale" scam alert (trendorna.store / janvikurti.info).
 *
 *   node scripts/seed-flipkart-scam-alert.js          # insert / update
 *   node scripts/seed-flipkart-scam-alert.js --dry    # print what would change
 *
 * Re-runnable: matches on the deal slug and updates in place, so editing the
 * copy below and re-running is the intended way to revise the alert.
 *
 * ── Why this listing is a "deal" at all ────────────────────────────────────
 * Deals are the only content type on the site that shows up in the homepage
 * grid, the store page, search and the sitemap — which is exactly the reach a
 * consumer warning needs. It carries badge = 'SCAM ALERT', which every deal
 * template treats specially: red banner, no "grab this deal" button, safety
 * steps instead of redemption steps. Do not rename the badge without updating
 * src/views/deal.ejs, src/views/home.ejs and partials/deal-card.ejs.
 *
 * ── Why it carries no price ────────────────────────────────────────────────
 * src/routes/pages.js only emits Product+Offer JSON-LD when `price != null`.
 * A warning must never be handed to Google as a purchasable offer, so price
 * and mrp stay NULL. Do not "fix" this by setting price = 0.
 *
 * ── What is deliberately NOT published here ────────────────────────────────
 * The phone number and Ahmedabad postal address listed on janvikurti.info are
 * held back from the public page. Scam sites routinely paste a real, unrelated
 * business's details as a front, and naming them publicly would defame whoever
 * actually owns them. They belong in the reports to Flipkart, Google and
 * cybercrime.gov.in, not on a page shoppers read.
 *
 * Honours DB_DRIVER (.env): sqlite locally, mysql in production.
 */

const db = require('../src/db');

const DRY = process.argv.includes('--dry');

// ── Facts, as observed. Update these if the scam infrastructure moves. ──────
const OBSERVED_ON  = '19 August 2026';
const AD_URL       = 'https://www.youtube.com/shorts/NmE4qWNVZt4';
const ADVERTISER   = 'Filp mart';           // sic — the advertiser name on the ad
const CLONE_DOMAIN = 'trendorna.store';
const PAY_DOMAIN   = 'janvikurti.info';
// The alert stays up until we can confirm the campaign is dead; a warning that
// silently expires is worse than no warning. Refresh this date on review.
const REVIEW_ON    = '2026-12-31';

// Resolved by slug, not id: store ids differ between the local seed
// (st_flipkart) and production (st_mrc0tpaspeim0), the slug does not.
const STORE_SLUG = 'flipkart';
const SLUG       = 'fake-flipkart-sale-scam-trendorna-store';

const TITLE = 'Scam Alert: Fake “Flipkart Electronics Sale” Ads on YouTube Send You to trendorna.store — Do Not Pay';

// Plain text. richText() escapes it and turns blank lines into <p> blocks, so
// no HTML here.
const DESCRIPTION = `On ${OBSERVED_ON} a reader sent us a sponsored YouTube Short advertising a “Flipkart Electronics Sale” with everything “just at ₹299”. It is not Flipkart. Every step after the ad is a copy, and the money goes to strangers.

We walked the whole funnel and stopped at the payment screen. Here is exactly what it does.

Step 1 — The ad

A paid Short runs on YouTube under the advertiser name “${ADVERTISER}” — a misspelling of Flipkart, one letter swapped. The creative uses Flipkart's real logo and wordmark and promises 87% to 97% off on Samsung, JBL, KENT and other brands. Because YouTube labels it “Sponsored”, it carries the credibility of a platform ad. It is not run by Flipkart.

Step 2 — The lookalike store

Tapping “Shop now” lands on ${CLONE_DOMAIN}, which brands itself “FlipMart — Shop More” in Flipkart's blue-and-yellow. The layout, the product page, the checkout steps and even Flipkart's “F-Assured” badge are copied. The URL carries Google Ads tracking parameters, so this is a bought ad campaign, not an organic video.

Step 3 — Prices that cannot exist

A OnePlus Nord CE6 5G (8GB/256GB) is listed at ₹699 against ₹36,999. A JBL PartyBox 710 is ₹399 against ₹59,999. The page adds “3538 people ordered this in the last 30 minutes” and “Only 3 Left in Stock” to rush you. No retailer, sale or clearance sells a ₹37,000 phone for ₹699. This is the tell — the entire scam depends on you not stopping to ask how.

Step 4 — The fake payment page

At checkout the site collects your name, mobile number and full delivery address, then hands you to ${PAY_DOMAIN}/pay/razorpay.php. That page is a copy of Razorpay's checkout with “Flipkart” printed as the merchant, offering UPI, cards, netbanking, wallets and a UPI QR code. Razorpay is a real payment company; this page is not theirs, and Flipkart is not the merchant. A genuine Flipkart order is never paid on a third-party domain.

What it costs you

If you pay, the money is gone — UPI transfers and card charges to a merchant you cannot identify are extremely hard to reverse. You have also handed over your name, phone number and home address, which is precisely the data used to set up the next round of “delivery” and “refund” calls.

If you have already paid

Call 1930 or file at cybercrime.gov.in immediately — reporting within the first few hours gives banks the best chance of freezing the transfer. Tell your bank or UPI app the same day and ask them to raise a dispute. Keep the screenshots, the UPI reference number and the SMS. Do not call any “customer care” number the site gave you; that leads back to the same people.

Where we have reported this

We have sent the ad, the domains and the payment page to Flipkart's grievance officer and brand-protection team, reported the sponsored ad to Google, and filed the details on cybercrime.gov.in.

How to check any “Flipkart sale” in five seconds

Flipkart sells only on flipkart.com and the official Flipkart app. Look at the address bar before you pay: if it does not say flipkart.com, it is not Flipkart, no matter what the logo says. Type the address yourself instead of tapping an ad, and treat any discount over about 80% as a warning rather than a win.

This alert describes what we observed on the ad and the sites named above on ${OBSERVED_ON}. Flipkart is a trademark of Flipkart Internet Private Limited and is named here only to identify the brand being impersonated — Flipkart itself is a victim of this campaign, not a party to it.`;

const HOW_TO = [
  'Never pay from an ad. Close it, open the Flipkart app or type flipkart.com yourself, and search for the product there.',
  'Read the address bar before every payment. A real Flipkart order is paid on flipkart.com — not on trendorna.store, janvikurti.info or any other domain.',
  'Treat impossible pricing as the alarm, not the offer. A ₹36,999 phone at ₹699 is not a sale; nobody sells at a 98% loss.',
  'Ignore “only 3 left” and “3,538 people ordered in the last 30 minutes”. These counters are hard-coded to stop you from thinking.',
  'Never scan a UPI QR or approve a UPI request to receive a discount. UPI collect requests take money out; they never pay it in.',
  'If you already paid: call 1930 or file at cybercrime.gov.in the same day, tell your bank, and keep every screenshot and UPI reference number.',
  'Report the ad itself on YouTube (⋮ → Report ad) so the campaign gets pulled — that stops it faster than any single takedown.'
];

// Full-size screenshots live in public/uploads/. Captions carry the URL bar
// evidence in text so the page is still useful when images are blocked.
const GALLERY = [
  { src: '/uploads/scam-flipkart-youtube-sponsored-ad.jpg',
    caption: `Step 1 — the sponsored YouTube Short, running under the advertiser name “${ADVERTISER}” with Flipkart's logo on the creative. ${AD_URL}` },
  { src: '/uploads/scam-flipkart-clone-trendorna-store.jpg',
    caption: `Step 2 — “Shop now” lands on ${CLONE_DOMAIN}, branded “FlipMart”. The URL carries Google Ads campaign parameters.` },
  { src: '/uploads/scam-flipkart-fake-price-oneplus.jpg',
    caption: 'Step 3 — a OnePlus Nord CE6 5G at ₹699 against ₹36,999, with Flipkart’s F-Assured badge copied and a fake "3538 people ordered" counter.' },
  { src: '/uploads/scam-flipkart-fake-order-summary.jpg',
    caption: 'Step 3 — the cloned checkout, after it has collected a name, phone number and full delivery address. ₹1,398 for stock worth ₹1,33,997.' },
  { src: '/uploads/scam-flipkart-fake-razorpay-janvikurti.jpg',
    caption: `Step 4 — payment moves to ${PAY_DOMAIN}/pay/razorpay.php, a copy of Razorpay's checkout showing "Flipkart" as the merchant. The payer's number is redacted by us.` }
];

(async () => {
  const stores = await db.query('SELECT id, name FROM stores WHERE slug = ?', [STORE_SLUG]);
  if (stores.length === 0) {
    console.error(`Store "${STORE_SLUG}" is missing — run "npm run db:seed" first.`);
    process.exit(1);
  }
  const storeId = stores[0].id;
  console.log(`Store: ${stores[0].name} (${storeId})`);

  const existing = await db.query('SELECT id FROM deals WHERE slug = ?', [SLUG]);
  const howTo   = JSON.stringify(HOW_TO);
  const gallery = JSON.stringify(GALLERY);
  const image   = '/uploads/scam-flipkart-fake-sale-how-it-works.jpg';
  // Comma-wrapped so `LIKE '%,slug,%'` stays exact, matching backfill-categories.
  const seoCats = ',electronics,';
  // deal_url is never used as a CTA on an alert (deal.ejs links to the store's
  // real site instead) but the column is what /go/d would fall back to, so it
  // points at Flipkart proper rather than anywhere near the scam.
  const dealUrl = 'https://www.flipkart.com';

  if (existing.length) {
    if (!DRY) {
      await db.query(`
        UPDATE deals SET store_id = ?, title = ?, description = ?, category = ?, seo_categories = ?,
          image_url = ?, gallery = ?, deal_url = ?, how_to = ?, badge = ?, expiry_date = ?,
          price = NULL, mrp = NULL, true_price = NULL, coupon_code = NULL, cashback_text = NULL,
          is_trending = 1, hotness = 50, is_active = 1, verified_at = NOW(), updated_at = NOW()
        WHERE slug = ?
      `, [storeId, TITLE, DESCRIPTION, 'electronics', seoCats, image, gallery, dealUrl, howTo,
          'SCAM ALERT', REVIEW_ON, SLUG]);
    }
    console.log(`${DRY ? '[dry-run] would update' : 'Updated'} alert ${SLUG} (${existing[0].id})`);
  } else {
    if (!DRY) {
      await db.query(`
        INSERT INTO deals (id, slug, store_id, title, description, category, seo_categories,
          image_url, gallery, mrp, price, coupon_code, deal_url, how_to, badge, cashback_text,
          is_trending, hotness, is_active, expiry_date, verified_at, posted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, NULL, 1, 50, 1, ?, NOW(), NOW())
      `, [db.uid('dl'), SLUG, storeId, TITLE, DESCRIPTION, 'electronics', seoCats,
          image, gallery, dealUrl, howTo, 'SCAM ALERT', REVIEW_ON]);
    }
    console.log(`${DRY ? '[dry-run] would create' : 'Created'} alert ${SLUG}`);
  }

  console.log(`\n→ /deal/${SLUG}`);
  console.log(`→ /store/flipkart`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
