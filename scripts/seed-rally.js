'use strict';

/**
 * Seeds the Rally refer-and-earn + Rally Race listing (store + deal).
 *
 *   node scripts/seed-rally.js          # insert / update
 *   node scripts/seed-rally.js --dry    # print what would change
 *
 * Rally (rallyapp.in, formerly "Spaid") is a bill-payment app run by
 * BeyoundExtra Tech Pvt Ltd. Its terms live on beyound.in/policies.
 *
 * Re-runnable: matches on the store slug and the deal slug and updates in
 * place, so editing the copy below and re-running is the intended way to
 * revise the listing.
 *
 * ── The reward is RallyCash, not rupees ─────────────────────────────────────
 * The app's Refer & earn card prints the tiers with a ₹ sign ("You ₹1000 ·
 * Friend ₹1000"), but the referral T&C (s.2, s.6) define RallyCash as reward
 * credits that offset eligible platform fees inside the app, "not actual
 * cash", not withdrawable. Every line below says RallyCash. Don't "simplify"
 * it to ₹1,000: that is the claim a reader would hold us to.
 *
 * ── Why no `price` ──────────────────────────────────────────────────────────
 * Nothing is sold. pages.js emits Product+Offer JSON-LD whenever price !=
 * null, and a ₹0 "product" for a referral bonus is the spammy structured data
 * the Claude-giveaway listing already avoids. price stays NULL.
 *
 * ── The clock starts at the click ───────────────────────────────────────────
 * Referral T&C s.3: "The timer starts when the referred user clicks the
 * referral link." The Grab button IS that click, so the get-ready steps are
 * written as "[before] …" and render above the automatic "Click Grab this
 * deal" step (see the deal route in src/routes/pages.js).
 *
 * ── Before running ──────────────────────────────────────────────────────────
 * 1. Paste the creator's own Rally referral link into REFERRAL_URL.
 * 2. Copy the five rally-*.jpg images into public/uploads/ on the server.
 * 3. Re-check the tiers in the app and both T&C pages on the day you run it.
 *
 * Honours DB_DRIVER (.env): sqlite locally, mysql in production.
 */

const db = require('../src/db');

const DRY = process.argv.includes('--dry');

// ── Edit these when Rally changes the offer ──────────────────────────────────
// The creator's own referral link from Rally → Refer & earn → share. Used for
// the deal CTA (/go/d) and the store's "Visit store" button (/go/s).
// RALLY_REFERRAL_URL in the environment overrides it (for local testing).
const REFERRAL_URL = process.env.RALLY_REFERRAL_URL || '';
const CHECKED_ON   = '22 November 2026';
// The race dates come from the app screen ("19 Oct – 15 Dec"); the race T&C
// only say the period is "as communicated through the Rally App". The
// referral offer itself has no end date, so after the race ends either
// re-check the tiers and roll this forward, or let the listing expire.
const REVIEW_ON    = '2026-12-15';
// Leaderboard as shown in the app on CHECKED_ON (names deliberately omitted).
const TOP3_POINTS  = { first: '23,051', second: '22,323', third: '16,646' };
// Optional: the Chotu Seth Short once it is live (YouTube URL), else null.
const VIDEO_URL    = null;

if (!/^https?:\/\//.test(REFERRAL_URL)) {
  console.error('REFERRAL_URL is empty. Paste your Rally referral link at the top of scripts/seed-rally.js\n' +
                '(or set RALLY_REFERRAL_URL), then run again. Nothing was written.');
  process.exit(1);
}

const STORE = {
  id:          'st_rally',
  slug:        'rally',
  name:        'Rally',
  color:       '#111111',
  category:    'bills-recharges',
  website_url: 'https://rallyapp.in',
  description: 'Rally (formerly Spaid) is a bill-payment app from BeyoundExtra Tech Pvt Ltd: credit-card bills, electricity and other utility bills, and mobile, DTH and broadband recharges from one app, with rewards paid as RallyCash, an in-app credit.'
};

const SLUG = 'rally-app-refer-earn-1000-rallycash-pay-bill-in-3-minutes';

const TITLE = 'Rally App Refer & Earn: Pay Your First Bill Within 3 Minutes, You and Your Friend Each Get 1,000 RallyCash (+ Rally Race: Top 3 Win a Bike)';

// Plain text. richText() escapes it, turns blank lines into <p> and single
// newlines into <br>, so no HTML here. It has to answer the reader's real
// question ("is this ₹1,000 free, and what's the catch?") honestly.
const DESCRIPTION = `Join the Rally bill-payment app through a referral link and pay a bill within 3 minutes: you and the friend who shared the link each get 1,000 RallyCash. RallyCash is in-app credit for Rally's fees, not cash. Separately, the Rally Race gives a bike to each of its top 3 bill-payers.

Rally (formerly Spaid) is a bill-payment app run by BeyoundExtra Tech Pvt Ltd. You pay credit-card bills, electricity and other utility bills, and mobile, DTH and broadband recharges from one app. Rally's website says bills clear over Bharat BillPay (BBPS). Two promotions are running together: a timed refer-and-earn offer, and the Rally Race, a bill-payment leaderboard whose top three each win a motorcycle.

The refer-and-earn offer, in plain words

You join Rally through a referral link and make a successful payment. The faster you pay after tapping the link, the bigger the reward, and you and the person who shared the link get the same amount:
• Pay within 3 minutes: 1,000 RallyCash each
• Within 3 to 10 minutes: 500 RallyCash each
• Within 10 to 30 minutes: 250 RallyCash each
• After 30 minutes: 100 RallyCash each

Rally's referral terms (last updated 23 October 2026) say the timer starts when the referred user clicks the referral link. The card inside the app words it as "Timer starts the second you invite a friend"; the written terms are the rule we go by. Only new users qualify, so an existing Rally account can't be referred. Failed, cancelled or reversed payments don't count, and one referral earns one tier.

What 1,000 RallyCash is, and what it isn't

The app shows the reward with a ₹ sign, but the referral terms define RallyCash as reward credits that "can be used to offset eligible platform fees within the Rally app". They also say it is "not actual cash" and can't be withdrawn or moved to a bank account. So 1,000 RallyCash is a credit against the fees Rally charges on your future payments, not ₹1,000 in your pocket. What it is worth to you depends on how often you pay through Rally and what fee each payment carries: Rally shows the fee before you pay and doesn't publish a fixed rate. The terms set no minimum payment amount and no end date for the referral offer, and Rally can change or stop it at any time.

How to make the 3 minutes

Three minutes has to cover installing the app, signing up and paying. That is tight, but it works if everything is ready before you tap:
• Have the bill you'll pay at hand: the credit card, or the electricity consumer number, or the mobile/DTH number for a recharge.
• Keep your UPI app or card on the same phone, and know your PIN.
• Use good Wi-Fi or 4G/5G. The iPhone app alone is about 62 MB.
• Tap the link on the phone you'll pay from, and install Rally from that link. The terms say a referred user "joins Rally through a valid referral link"; they don't say what happens if you install or sign up some other way first, so don't.
• Pay a real bill you were going to pay anyway. The terms set no minimum, so it needn't be a big one.
Miss the 3 minutes and you still get 500, 250 or 100 RallyCash. Don't rush into a payment you didn't mean to make.

Rally Race: the bike leaderboard

The race runs 19 October – 15 December 2026, as shown in the app (the written terms say the campaign period is whatever the app communicates). The top three on the final verified leaderboard each win a bike:
• 1st place: Aprilia RS 457
• 2nd place: BMW G310 RR (the race terms say RR; the card in the app says "G310 GS")
• 3rd place: Triumph Speed T4

How points work, from the race terms: every ₹1,000 of eligible payments is one base point. Boosts then multiply your score. Each referral adds 10% (four referrals = ×1.4), completed KYC adds 10%, and a few in-app steps add 20–30% each (DFA and Class Upgrade initialisation and action, Financial Fitness). Boosts of different kinds multiply together.

Be realistic about the bike. On ${CHECKED_ON} the app showed the top three on ${TOP3_POINTS.first}, ${TOP3_POINTS.second} and ${TOP3_POINTS.third} points. Without boosts, ${TOP3_POINTS.third} points means about ₹1.66 crore of payments. Even with every one-time boost (×4.18 together, if each counts once) and 10 referrals (×2), third place still needs roughly ₹20 lakh. The race suits very heavy card users and businesses; for most people the referral reward is the prize that's actually within reach. Never pay bills you wouldn't otherwise pay, or put other people's payments through your card, to chase points. The race terms disqualify fraud and multiple accounts, and leaderboard positions stay provisional until Rally verifies them.

One more rule: the race terms (s.3.4 and s.8.6) say a user who has already received a reward under any other Beyound campaign on the Rally app can't win a bike, whatever their rank. They don't say whether referral RallyCash counts as such a reward. If the bike is your goal, ask Rally support before you claim a referral reward.

Before you trust it with big payments

Rally is a young app. Its App Store listing is rated 4.5 from about 4,300 ratings, and the reviews shown there include people whose card payments were debited but stayed "in progress" for days. Its homepage labels its RBI, PCI DSS and ISO marks as "illustrative", and its wallet terms name no RBI licence number or partner bank. Rally's terms say failed transactions are refunded within 5–7 working days. Our advice: make your first payment a small one, check that it reached your card or biller, keep the receipt with its reference number until it clears, and pay well before your card's due date, so a delayed payment can never cost you a late fee.

Safety: you only ever pay your own bill, inside the Rally app, to your own card or biller. Nobody from Rally or IndiaOffers will ask you to send money to a person, or for an OTP, UPI PIN or card PIN. If anyone does, it's a scam: report it at cybercrime.gov.in or call 1930.

Disclosure: the button on this page is IndiaOffers' own Rally referral link. When you join through it and pay, Rally credits us the same RallyCash tier it credits you. That doesn't reduce your reward. IndiaOffers isn't affiliated with Rally or BeyoundExtra Tech. Aprilia, BMW and Triumph and their model names are trademarks of their owners, named here only to identify the prizes. Terms checked ${CHECKED_ON}: Referral T&C and Rally Race T&C at beyound.in/policies.`;

// "[before]" steps render above the automatic "Click Grab this deal" step,
// because the 3-minute clock starts at that click.
const HOW_TO = [
  `[before] Get ready first: the 3 minutes start the moment you tap the button. Keep the bill you'll pay at hand (credit card, electricity consumer number or mobile number) and your UPI app or card on this phone.`,
  `[before] Use the phone you'll pay from, on good Wi-Fi or mobile data. Don't sign up for Rally any other way beforehand: only new users who join through the link qualify.`,
  `Install Rally from the link and sign up with your mobile number and OTP.`,
  `Pay a real bill in the app. Paid within 3 minutes of the tap = 1,000 RallyCash for you (and the same for us); within 10 minutes 500, within 30 minutes 250, later 100.`,
  `Check that the payment reached your card or biller and keep the receipt. RallyCash is credited after Rally verifies the payment; it offsets Rally's fees and can't be withdrawn.`,
  `Chasing the Rally Race bikes? Read the points maths and the "previous reward" rule on this page first.`
];

// Full-size images live in public/uploads/ (not in git; copy them to the
// server). Other users' names are blurred out of the leaderboard stills.
const IMAGE = '/uploads/rally-refer-3-minutes.jpg';
const GALLERY = [
  { src: '/uploads/rally-refer-earn-tiers.jpg',
    caption: `Rally's Refer & earn card (photographed ${CHECKED_ON}). The app prints the tiers with a ₹ sign; the referral terms say the reward is RallyCash, an in-app credit that can't be withdrawn.` },
  { src: '/uploads/rally-race-1st-rs457.jpg',
    caption: `Rally Race, 1st place: Aprilia RS 457, held at ${TOP3_POINTS.first} points on ${CHECKED_ON} (name blurred).` },
  { src: '/uploads/rally-race-2nd-g310.jpg',
    caption: `2nd place: BMW G310, held at ${TOP3_POINTS.second} points. The race terms name it the G310 RR; the app card says G310 GS.` },
  { src: '/uploads/rally-race-3rd-speed-t4.jpg',
    caption: `3rd place: Triumph Speed T4, held at ${TOP3_POINTS.third} points. Race dates in the app: 19 Oct – 15 Dec.` }
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
          STORE.website_url, REFERRAL_URL]);
    }
    console.log(`${DRY ? '[dry-run] would create' : 'Created'} store ${STORE.slug}`);
  } else {
    if (!DRY) {
      await db.query(`
        UPDATE stores SET name = ?, color = ?, category = ?, description = ?, website_url = ?,
          affiliate_url = ?, affiliate_type = 'none', cashback_text = NULL, is_active = 1
        WHERE slug = ?
      `, [STORE.name, STORE.color, STORE.category, STORE.description, STORE.website_url,
          REFERRAL_URL, STORE.slug]);
    }
    console.log(`${DRY ? '[dry-run] would update' : 'Updated'} store ${STORE.slug} (${existingStore[0].id})`);
  }
  const storeId = existingStore.length ? existingStore[0].id : STORE.id;

  // ── Deal ─────────────────────────────────────────────────────────────────
  const existingDeal = await db.query('SELECT id FROM deals WHERE slug = ?', [SLUG]);
  const howTo   = JSON.stringify(HOW_TO);
  const gallery = JSON.stringify(GALLERY);
  // Comma-wrapped so `LIKE '%,slug,%'` stays exact, matching backfill-categories.
  const seoCats = ',bills-recharges,';

  if (existingDeal.length) {
    if (!DRY) {
      await db.query(`
        UPDATE deals SET store_id = ?, title = ?, description = ?, category = ?, seo_categories = ?,
          image_url = ?, gallery = ?, video_url = ?, deal_url = ?, how_to = ?, badge = ?, expiry_date = ?,
          price = NULL, mrp = NULL, true_price = NULL, coupon_code = NULL, cashback_text = NULL,
          is_active = 1, verified_at = NOW(), updated_at = NOW()
        WHERE id = ?
      `, [storeId, TITLE, DESCRIPTION, 'bills-recharges', seoCats, IMAGE, gallery, VIDEO_URL,
          REFERRAL_URL, howTo, 'NEW', REVIEW_ON, existingDeal[0].id]);
    }
    console.log(`${DRY ? '[dry-run] would update' : 'Updated'} deal ${SLUG} (${existingDeal[0].id})`);
  } else {
    if (!DRY) {
      await db.query(`
        INSERT INTO deals (id, slug, store_id, title, description, category, seo_categories,
          image_url, gallery, video_url, mrp, price, coupon_code, deal_url, how_to, badge, cashback_text,
          is_trending, hotness, is_active, expiry_date, verified_at, posted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, NULL, 1, 5, 1, ?, NOW(), NOW())
      `, [db.uid('dl'), SLUG, storeId, TITLE, DESCRIPTION, 'bills-recharges', seoCats,
          IMAGE, gallery, VIDEO_URL, REFERRAL_URL, howTo, 'NEW', REVIEW_ON]);
    }
    console.log(`${DRY ? '[dry-run] would create' : 'Created'} deal ${SLUG}`);
  }

  console.log(`\n→ /deal/${SLUG}`);
  console.log('→ /rally (short path used in the video)');
  console.log(`→ /store/${STORE.slug}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
