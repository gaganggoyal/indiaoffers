'use strict';

/**
 * SEO landing pages — the high-intent "deal-type" pages people actually search
 * for: loot deals, ₹1 deals, free products, steal deals, under-₹99, flash sales,
 * cashback deals and coupon codes.
 *
 * Each collection is a curated view over the deals table (or the coupons table)
 * with its own keyword-optimised <title>, <h1>, intro copy and FAQ block. The
 * routes are registered from src/routes/pages.js; aliases 301-redirect to the
 * canonical slug so we never split link equity across near-duplicate URLs.
 *
 * `where` is a hard-coded SQL fragment (never user input) AND-ed onto
 * `d.is_active = 1`; `d` is the deals table alias used by the collection route.
 */

const COLLECTIONS = [
  {
    slug: 'loot-deals',
    emoji: '🔥',
    nav: 'Loot Deals',
    aliases: ['loot', 'loot-offers', 'loot-deal', 'loot-deals-today', 'todays-loot-deals', 'today-loot-deals', 'loot-deals-online-shopping'],
    h1: 'Loot Deals Today',
    title: 'Loot Deals Today — Biggest Online Shopping Loot Offers in India | IndiaOffers.in',
    description: "Today's biggest loot deals in India — massive 70%+ off loot offers, price-error steals and limited-time loot deals across Amazon, Flipkart, Myntra & top stores. Grab them before they're gone.",
    keywords: 'loot deals, loot offers, loot deals today, online shopping loot deals, loot deal, todays loot deals, amazon loot deals, flipkart loot deals, loot deals India',
    where: "(UPPER(d.badge) = 'LOOT' OR (d.mrp > 0 AND d.price <= d.mrp * 0.30))",
    order: '(CASE WHEN UPPER(d.badge) = \'LOOT\' THEN 0 ELSE 1 END), d.is_trending DESC, d.posted_at DESC',
    intro: "A <strong>loot deal</strong> is a deal so heavily discounted it feels like a loot — think 70%, 80%, even 90% off, plus the odd price-error steal. We hand-pick the best <strong>loot offers</strong> live across Amazon, Flipkart, Myntra, Ajio and more, and stack card &amp; bank offers on top so you pay the true lowest price. Loot deals sell out fast — check back through the day, these move quickly.",
    faqs: [
      { q: 'What are loot deals?', a: 'Loot deals are products selling at an unusually steep discount — typically 70% off or more, and sometimes a genuine price-error steal. They are the best-value deals on the internet at any given moment, which is why they sell out fast.' },
      { q: 'Are these loot deals real and safe to buy?', a: 'Yes. Every loot deal here links straight to the official merchant page (Amazon, Flipkart, Myntra, etc.). Prices change fast, so always confirm the final price on the merchant page before you pay.' },
      { q: 'How often are loot deals updated?', a: 'Continuously through the day. Loot deals have limited stock and short windows, so we refresh this page as new ones go live and drop the ones that have ended.' }
    ]
  },
  {
    slug: 'rupee-1-deals',
    emoji: '🪙',
    nav: '₹1 Deals',
    aliases: ['re-1-deals', 're1-deals', 're-1-deal', 'rupee-1-deal', 'rupee-one-deals', '1-rupee-deals', '1-rupee-deal', 'rs-1-deals', 'rs1-deals', 'one-rupee-deals'],
    h1: '₹1 Deals — Re.1 Deals Today',
    title: '₹1 Deals Today — Re.1 & 1 Rupee Deals in India | IndiaOffers.in',
    description: 'Buy products for just ₹1! Live Re.1 deals and 1 rupee deals in India — grab phones, gadgets, fashion and more for a single rupee in flash sales across top stores. Updated daily.',
    keywords: 're.1 deals, re 1 deals, rupee 1 deal, rupee 1 deals, 1 rupee deals, rs 1 deals, one rupee deals, re.1 deal, 1 rupee sale, rupee one deals India',
    where: '(d.price IS NOT NULL AND d.price > 0 AND d.price <= 1)',
    order: 'd.is_trending DESC, d.posted_at DESC',
    intro: "<strong>Re.1 deals</strong> (also called <strong>₹1 deals</strong> or <strong>1 rupee deals</strong>) let you buy a product for a single rupee in a flash sale. Stores run them to launch products or reward early shoppers — stock is tiny and they vanish in minutes. Every live ₹1 deal we can find is listed below. Set an account alert so you never miss the next one rupee sale.",
    faqs: [
      { q: 'What is a Re.1 deal?', a: 'A Re.1 deal (₹1 deal) lets you buy a product for just one rupee, usually in a short flash sale with very limited stock. Brands use them to launch products or reward fast shoppers.' },
      { q: 'How do I get a ₹1 deal before it sells out?', a: 'Be ready before the sale goes live — keep your address and payment saved, refresh this page, and create a free IndiaOffers account to get an alert the moment a new ₹1 deal drops.' },
      { q: 'Are 1 rupee deals genuine?', a: 'Yes, when they come from the official store. Each deal here links to the merchant page — just confirm the ₹1 price at checkout, as stock runs out extremely fast.' }
    ]
  },
  {
    slug: 'free-deals',
    emoji: '🎁',
    nav: 'Free Products',
    aliases: ['free-products', 'freebies', 'free-samples', 'free-deals-today', 'free-product-deals', 'free-sample-offers'],
    h1: 'Free Products & Freebies Today',
    title: 'Free Products & Freebies Today — Free Samples & ₹0 Deals in India | IndiaOffers.in',
    description: 'Get free products, free samples and freebies in India — ₹0 deals and free-after-cashback offers across top stores. Claim genuine freebies before stock runs out. Updated daily.',
    keywords: 'free products, freebies, free samples, free deals, free stuff India, ₹0 deals, free product offers, free sample offers, free after cashback',
    where: '(d.price IS NOT NULL AND d.price <= 0)',
    order: 'd.is_trending DESC, d.posted_at DESC',
    intro: "Everyone loves a <strong>freebie</strong>. Below are live <strong>free product</strong> and <strong>free sample</strong> offers in India — items you can claim for ₹0, plus free-after-cashback deals. Genuine freebies have tiny stock and go fast, so grab them quickly and always confirm the ₹0 price at checkout.",
    faqs: [
      { q: 'Are these free products really free?', a: 'Yes — these are ₹0 deals and free-sample offers from the official stores. Some may charge a small shipping fee or be free-after-cashback, so check the merchant page before ordering.' },
      { q: 'How do I get free samples in India?', a: 'Brands offer free samples to introduce new products. Claim them from the links below while stock lasts, and create a free account to be alerted when new freebies drop.' }
    ]
  },
  {
    slug: 'steal-deals',
    emoji: '🥷',
    nav: 'Steal Deals',
    aliases: ['steal-deal', 'steal-offers', 'steal-deals-today', 'best-steal-deals'],
    h1: 'Steal Deals — 80%+ Off Today',
    title: 'Steal Deals Today — 80% Off & More Across Top Indian Stores | IndiaOffers.in',
    description: 'Steal deals with 80% off and more — the deepest-discount steal offers in India, hand-picked across Amazon, Flipkart, Myntra and top stores. Card offers stacked for the true lowest price.',
    keywords: 'steal deals, steal offers, 80% off deals, best steal deals, deepest discount deals, steal deals today India',
    where: '(d.mrp > 0 AND d.price <= d.mrp * 0.20)',
    order: '((d.mrp - d.price) / d.mrp) DESC, d.posted_at DESC',
    intro: "<strong>Steal deals</strong> are the deepest discounts on the internet right now — 80% off and beyond. We surface only the genuine steals (real MRP, real savings) and stack bank &amp; card offers on top so the price you see is the true lowest price. These are the deals worth dropping everything for.",
    faqs: [
      { q: 'What counts as a steal deal?', a: 'We list a deal as a steal only when the discount is 80% or more off the genuine MRP. No inflated MRPs — just real, deep savings.' },
      { q: 'Can I save even more on a steal deal?', a: 'Often yes. We automatically show the best applicable bank, card or UPI offer on top of the steal price, so you can see the true lowest price before you buy.' }
    ]
  },
  {
    slug: 'under-99-deals',
    emoji: '💯',
    nav: 'Under ₹99',
    aliases: ['under-99', 'deals-under-99', '99-store', 'under-99-store', 'products-under-99'],
    h1: 'Deals Under ₹99',
    title: 'Deals Under ₹99 — Best Products Under 99 Rupees in India | IndiaOffers.in',
    description: 'Shop the best deals under ₹99 in India — quality products under 99 rupees across fashion, home, gadgets and more. Budget steals updated daily, with card offers stacked on top.',
    keywords: 'deals under 99, products under 99, under 99 store, 99 store, budget deals, cheap deals India, deals under 100',
    where: '(d.price IS NOT NULL AND d.price > 1 AND d.price <= 99)',
    order: 'd.price ASC, d.is_trending DESC',
    intro: "Great things do come cheap. These are the best <strong>deals under ₹99</strong> in India right now — everyday-use products, accessories, home &amp; kitchen picks and more, all under 99 rupees. Perfect for adding to a cart to cross a free-shipping threshold, or just grabbing a bargain.",
    faqs: [
      { q: 'Are under-₹99 products worth buying?', a: 'The picks here are chosen for value, not just a low price. Read the merchant reviews on the product page, and remember many pair nicely with a bank offer for an even lower effective price.' }
    ]
  },
  {
    slug: 'flash-deals',
    emoji: '⚡',
    nav: 'Flash Deals',
    aliases: ['lightning-deals', 'flash-sale', 'flash-deal', 'flash-sale-deals', 'lightning-deal'],
    h1: 'Flash Deals & Lightning Sales',
    title: 'Flash Deals & Lightning Sales Today — Limited-Time Offers in India | IndiaOffers.in',
    description: 'Live flash deals and lightning sales in India — trending, limited-time offers across Amazon, Flipkart, Myntra and more. Time-sensitive prices, updated live. Grab them before the timer runs out.',
    keywords: 'flash deals, lightning deals, flash sale, lightning sale, limited time deals, trending deals today, deal of the day India',
    where: '(d.is_trending = 1)',
    order: 'd.posted_at DESC',
    intro: "<strong>Flash deals</strong> (a.k.a. lightning deals) are the hottest, time-sensitive offers trending right now. Prices drop for a short window and jump back up once the timer or stock runs out. Everything below is live and moving fast — grab it before it's gone.",
    faqs: [
      { q: 'How long do flash deals last?', a: 'Flash and lightning deals run for a short window — sometimes hours, sometimes until limited stock sells out. If a deal you want is here, buy it sooner rather than later.' },
      { q: 'Will the price go back up?', a: 'Usually, yes. Flash-deal pricing is temporary. Once the window closes the price typically returns to normal, so treat these as buy-now offers.' }
    ]
  },
  {
    slug: 'cashback-deals',
    emoji: '💰',
    nav: 'Cashback',
    aliases: ['cashback-offers', 'cashback', 'cashback-deals-today', 'best-cashback-offers'],
    h1: 'Cashback Deals & Offers',
    title: 'Cashback Deals & Offers Today — Best Cashback Offers in India | IndiaOffers.in',
    description: 'Earn extra with the best cashback deals and offers in India — products with cashback stacked on discount and card offers across top stores. Get the true lowest price after cashback.',
    keywords: 'cashback deals, cashback offers, best cashback, cashback offers today, cashback on shopping, cashback deals India',
    where: "(d.cashback_text IS NOT NULL AND d.cashback_text <> '')",
    order: 'd.is_trending DESC, d.posted_at DESC',
    intro: "Stack even more savings with <strong>cashback deals</strong> — offers where you earn money back on top of the discount. Below are live deals with a cashback component, plus the best applicable bank &amp; card offers, so you get the true lowest price after cashback.",
    faqs: [
      { q: 'How does cashback work?', a: 'Cashback returns a part of what you paid — as store credit, wallet balance or a card statement credit — after your purchase. It stacks on top of the deal discount and any card offer, lowering your effective price.' }
    ]
  },
  {
    slug: 'coupons',
    type: 'coupons',
    emoji: '🎟️',
    nav: 'Coupons',
    aliases: ['coupon-codes', 'coupons-today', 'promo-codes', 'discount-coupons', 'coupon-code', 'offer-coupons'],
    h1: 'Coupon Codes & Promo Codes',
    title: 'Coupon Codes Today — Verified Promo & Discount Codes in India | IndiaOffers.in',
    description: 'Working, verified coupon codes and promo codes for India — the latest discount coupons across Amazon, Flipkart, Myntra, Ajio and top stores. Copy, paste and save. Updated daily.',
    keywords: 'coupon codes, promo codes, discount coupons, coupons today, working coupons, verified coupon codes, offer codes India',
    intro: "Every <strong>coupon code</strong> below is live and, where marked ✅, verified by us. Copy the code, paste it at checkout on the store, and save instantly. We keep the list fresh across Amazon, Flipkart, Myntra, Ajio and more — bookmark this page for the latest <strong>promo codes</strong> and <strong>discount coupons</strong>.",
    faqs: [
      { q: 'How do I use a coupon code?', a: 'Copy the code here, add your items to the cart on the store, and paste the code into the promo/coupon box at checkout before you pay. The discount applies instantly if the code is valid.' },
      { q: 'Why did my coupon code not work?', a: 'Coupons can expire, run out, or apply only above a minimum order or to specific products. Try another code from the list — the ones marked ✅ verified are the most reliable.' }
    ]
  }
];

const bySlug = Object.fromEntries(COLLECTIONS.map(c => [c.slug, c]));

module.exports = { COLLECTIONS, collectionBySlug: slug => bySlug[slug] };
