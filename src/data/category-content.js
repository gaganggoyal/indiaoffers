'use strict';

/**
 * Hand-written editorial content for the /category/<slug> hub pages.
 * One entry per taxonomy node (departments and leaf categories).
 *
 * Google's Helpful Content system punishes thin, templated category pages, so
 * every intro here is written for that specific category — how discounts
 * actually behave in it, when the real sales happen, and how to stack savings.
 * Keep it that way: when adding a category, write fresh copy, don't clone.
 *
 * Shape: { intro: 'paragraphs separated by \n\n', faqs: [{ q, a }] }
 * `faqs` is optional; when present it is also emitted as FAQPage JSON-LD.
 */

const CATEGORY_CONTENT = {

  // ── Departments ─────────────────────────────────────────────────────────────
  'dept-electronics': {
    intro: `Electronics is where Indian online shopping discounts are deepest — and where fake discounts are most common. MRPs on gadgets are routinely inflated 30–60%, so the sticker "% OFF" means little; what matters is the lowest real selling price, and that is exactly what we track. Every electronics deal on this page is checked against the product's actual street price before it goes live.

The biggest genuine price drops cluster around Flipkart Big Billion Days and Amazon Great Indian Festival (September–October), Republic Day sales (January) and end-of-financial-year clearances (March). Between sales, the reliable savings lever is bank-card stacking: an instant 10% card discount on top of a deal price beats most "sale" prices. Check the card offers we list on each deal before you pay.`,
    faqs: [
      { q: 'When is the best time to buy electronics online in India?', a: 'Late September to October (Flipkart Big Billion Days and Amazon Great Indian Festival) sees the year\'s lowest prices on phones, TVs and laptops. Republic Day (January) and end-of-financial-year sales (March) are the next best windows.' },
      { q: 'Are the big "% OFF" numbers on gadgets real?', a: 'Often not — MRPs on electronics are inflated, so a "60% off" TV may only be 10–15% below its usual selling price. We verify each deal against the product\'s recent street price, not its MRP, before listing it.' },
      { q: 'How do I get an extra discount on top of the deal price?', a: 'Bank card offers. Most big electronics sales carry an instant 10% discount on specific credit/debit cards or EMI. Every deal page on IndiaOffers shows the applicable card offers and your effective price after stacking them.' }
    ]
  },

  'dept-fashion': {
    intro: `Fashion has the most volatile pricing of any online category in India — the same kurta or sneaker can swing 40% in a week across Myntra, Ajio, Amazon and Flipkart. Flat "70–80% off" racks are normal here, which makes the real skill knowing whether a price is a genuine season-low or an inflated-MRP illusion. We list fashion deals only when the price is genuinely at or near its recent low.

End-of-season sales (EOSS) in January and July are the two big clearance windows, with Myntra's EOSS and Ajio's Big Bold Sale usually offering the deepest cuts. Coupon codes matter more in fashion than anywhere else — first-order codes, app-only codes and bank offers frequently stack on top of sale prices.`,
    faqs: [
      { q: 'When do fashion prices drop the most?', a: 'End-of-season sales in January (winter clearance) and July (summer clearance). Myntra EOSS and Ajio Big Bold Sale are the biggest, with genuine 60–80% cuts on outgoing-season stock.' },
      { q: 'Do coupon codes still work on already-discounted fashion?', a: 'Frequently, yes — fashion is the one category where coupons regularly stack on sale prices. Look for app-only codes, first-purchase codes and bank instant discounts on the deal page before paying.' },
      { q: 'How do I avoid fake discounts on clothing?', a: 'Ignore the MRP strike-through and compare the selling price across Myntra, Ajio, Amazon and Flipkart — the same item is often listed on all four at different prices. We do that comparison before a deal is published here.' }
    ]
  },

  'dept-home': {
    intro: `Home and kitchen is the quiet gold-mine of online deals in India: less hyped than electronics, so genuinely deep discounts (cookware sets, storage, tools, small appliances) sit around for days instead of selling out in minutes. It's also the category with the most ₹99–₹299 loot-level pricing on branded goods.

Watch for two patterns: festive-season home-makeover sales around Diwali (September–November), when furniture and appliances hit their yearly lows, and quiet weekday price-drops on kitchenware that never get advertised — the kind our deal hunters exist to catch. Card offers on furniture EMIs are often worth more than the visible discount.`,
    faqs: [
      { q: 'When is furniture cheapest online in India?', a: 'The Diwali window (September–November) — Amazon, Flipkart, Pepperfry and Urban Ladder all run their deepest furniture discounts then, and no-cost EMI plus card offers stack on top.' },
      { q: 'Are the ₹99–₹299 kitchen deals genuine?', a: 'Usually yes, but they are lightning deals on limited stock. We timestamp when each was last verified — if a loot price is more than a day old, re-check it on the store before ordering in bulk.' }
    ]
  },

  'dept-daily': {
    intro: `Grocery and daily essentials are where small percentages compound into real money — a household spending ₹8,000–₹12,000 a month on groceries can reliably save 10–20% by buying staples on the right platform on the right day. Amazon Fresh, Flipkart Minutes, BigBasket, Blinkit, Zepto and JioMart run rotating category discounts, and the same basket can differ 15% between them on any given day.

The tactics that work: monthly super-saver days (BigBasket and Amazon run these at the start of each month), buy-more-save-more slabs on staples, and payment-method offers (UPI cashbacks and card discounts on grocery are among the most frequent bank offers we track). Health, baby and toy deals in this department follow festive cycles instead — stock up during sale events.`,
    faqs: [
      { q: 'Which day of the month is best for grocery shopping online?', a: 'The first week. BigBasket, Amazon Fresh and JioMart run their monthly super-saver events at the start of the month, and payment offers (UPI/card cashback) usually refresh then too.' },
      { q: 'How much can I realistically save on monthly groceries?', a: '10–20% consistently, by combining platform sale days, buy-more slabs on staples and a payment offer. On a ₹10,000 monthly basket that is ₹12,000–₹24,000 a year.' }
    ]
  },

  'dept-lifestyle': {
    intro: `This department collects the categories that reward patience and timing: sports gear, car and bike accessories, books, hobby supplies, travel and OTT subscriptions — and our favourite loophole of all, flat discounts on bill payments. Discounts here are less about mega sale events and more about knowing the recurring offers: annual-plan pricing on OTT, off-season travel fares, and gift-card routes that make even "never discounted" spends 5% cheaper.

Travel and subscription deals expire fastest of anything we list, so check the verified timestamp on each deal. Bill-payment and recharge offers, on the other hand, tend to be repeatable month after month once set up.`,
    faqs: [
      { q: 'Can I really get a discount on electricity and mobile bills?', a: 'Yes — not from the biller, but via the payment route. Buying platform gift cards with the right card earns 5%+ back, and that balance pays recharges, electricity, DTH and insurance. See our bills & recharges category for the live method.' },
      { q: 'When are flight and hotel deals cheapest?', a: 'Mid-week fare sales (airlines announce these Tuesday–Thursday) and pre-season windows — book summer travel in February–March and winter travel in September for the widest discounts.' }
    ]
  },

  // ── Electronics leaves ──────────────────────────────────────────────────────
  'mobiles': {
    intro: `Mobile phones are India's most competitively priced online category — and the one where timing matters most. New launches drop 10–20% within 3–4 months; last-generation flagships routinely lose 30–40% once a successor ships. The sharpest prices appear as exchange-plus-card-offer combinations during Flipkart Big Billion Days and Amazon Great Indian Festival, when effective prices can undercut launch price by half.

Our mobile deals show the effective price after stackable card offers, not just the sticker. Accessories (cases, chargers, cables) follow a different rule: they are loot-deal territory, with branded items regularly at ₹99–₹199 — grab those when listed, they expire in hours.`,
    faqs: [
      { q: 'Should I buy a phone at launch or wait?', a: 'Unless you need day-one hardware, wait 3–4 months — most Android phones drop 10–20% by then. Flagships fall hardest right after their successor launches.' },
      { q: 'How do exchange offers actually work?', a: 'The platform quotes a value for your old phone (condition-dependent) and deducts it at checkout; a pickup agent verifies the device on delivery. During big sales, bonus exchange values of ₹3,000–₹10,000 stack on top of the quote.' }
    ]
  },

  'computers': {
    intro: `Laptops and PC components have two honest discount seasons in India: back-to-college (June–July) and the Diwali sale window (September–October). Outside those, the real savings come from card-offer stacking — laptop deals with a 10% instant card discount plus no-cost EMI are common year-round — and from previous-generation processors, which drop steeply the moment new silicon launches at the same price points.

Watch RAM/SSD upgrades too: the ₹5,000 gap between two configurations is often cheaper than upgrading later. We flag which configuration of a deal is actually the value pick.`,
    faqs: [
      { q: 'Is it safe to buy laptops online rather than in a shop?', a: 'Yes — warranty is identical (brand-served, not store-served), online pricing is usually lower, and open-box delivery verification is available on Amazon and Flipkart for most laptops. Keep the invoice; that is all the service centre needs.' }
    ]
  },

  'tv-appliances': {
    intro: `TVs and large appliances carry the most inflated MRPs in Indian e-commerce — 50–70% "off" is the baseline, so judge deals only on the final price against the model's recent lows. Genuine bottoms happen during Diwali sales and around cricket tournaments (TV prices dip before every World Cup and IPL season).

For ACs and refrigerators, buy against the season: AC prices bottom out in November–January, exactly when nobody wants one. Installation and exchange terms matter as much as price on appliances — our deal notes call out when free installation or an exchange bonus is part of the offer.`,
    faqs: [
      { q: 'When are AC prices lowest?', a: 'Winter — November to January. The same split AC that peaks in April–May is typically 15–25% cheaper off-season, and stock of the outgoing year\'s models is cleared with extra cuts around March.' },
      { q: 'Is a 55-inch TV under ₹30,000 too good to be true?', a: 'No — Indian and Chinese brands genuinely sell 4K 55-inch panels at that price during sales. What you trade off is peak brightness and after-sales network, not a working TV. Check panel type (VA vs IPS) in the deal details.' }
    ]
  },

  'electronics': {
    intro: `Audio gear, smartwatches, power banks and small gadgets are the loot-deal heart of Indian e-commerce: this is where ₹1,999 earbuds hit ₹799 and branded power banks fall under ₹500. Prices swing daily, and boAt, Noise, Realme and OnePlus accessories rotate through flash discounts continuously — which is why our verified-timestamp matters most in this category.

True-wireless earbuds and budget smartwatches are aggressive festive-sale categories, but honestly good prices show up every week. If a deal here is under 48 hours old, the price is very likely still live.`,
    faqs: [
      { q: 'Why do earbud prices change so often?', a: 'Indian audio brands (boAt, Noise, Boult, Realme) compete on rotating flash sales rather than stable pricing — the same model cycles between MRP and 60–70% off every few weeks. Buy in the dip; never at sticker price.' }
    ]
  },

  'video-games': {
    intro: `Gaming deals in India split into three streams: console hardware (discounted mainly during Diwali sales and consoles' own anniversary events), physical games (steep clearance cuts on titles older than a year), and digital codes and subscriptions, where gift-card routes and regional pricing quietly beat any visible sale. PS Plus and Game Pass subscriptions are cheapest bought during their 2–3 annual promotional windows.

Controller and accessory deals appear weekly and expire fast; AAA physical titles under ₹1,499 are the recurring sweet spot worth waiting for.`
  },

  // ── Fashion leaves ──────────────────────────────────────────────────────────
  'fashion': {
    intro: `Clothing online in India is a permanent sale with occasional real ones — the trick is telling them apart. Genuine lows arrive at end-of-season (January and July), during Myntra EOSS and Ajio Big Bold Sale, and on festive-sale opening days when fresh stock gets its one honest discount. Outside those windows, "70% off" usually means "normal price".

Stack ruthlessly here: fashion is the category where coupon codes, app-only pricing, first-order discounts and bank offers all combine. A ₹1,999 sale-price kurta set can realistically land at ₹1,300 after stacking. Every fashion deal we post lists what stacks with it.`,
    faqs: [
      { q: 'Myntra, Ajio, Amazon or Flipkart — which is cheapest for clothes?', a: 'No single winner — the same brand differs 10–30% between them on any given item. Myntra and Ajio go deepest during their own EOSS events; Amazon and Flipkart win on basics and during their festive sales. We compare before posting a deal.' },
      { q: 'What is the catch with 80% off clothing?', a: 'Usually outgoing-season stock, broken size runs, or inflated MRP. The first two are fine if your size is in stock; the third is why we verify prices against recent selling history, not MRP.' }
    ]
  },

  'footwear': {
    intro: `Footwear discounts run deeper than clothing — 50–70% off Nike, Adidas, Puma and Campus is routine on last-season colourways, because shoes date by look, not function. Flipkart and Myntra clear athletic shoes hardest; Ajio often has the best formal-shoe cuts.

The dependable play: pick the model, then wait for a colourway you like to hit clearance. Sizes vanish from the middle out, so common sizes (UK 8–9 men, UK 4–5 women) go first in any real deal — if your size is common, act on fresh deals fast.`
  },

  'watches': {
    intro: `Watch pricing online splits sharply: fashion-brand analog watches (Fossil, Titan, Casio) carry heavy inflated-MRP discounting year-round, while smartwatches behave like electronics — rapid generational price drops and weekly flash sales on Indian brands (Noise, Fire-Boltt, boAt). Casio's cult models and Titan's classics see their honest lows during festive sales.

For premium watches, authorised-seller listings matter more than price; our deals link only to authorised storefronts, so the brand warranty is always intact.`
  },

  'jewellery': {
    intro: `Online jewellery savings hide in the making charges, not the gold. Gold prices are uniform, but making charges (8–25%) are where Tanishq, CaratLane, Bluestone and Melorra compete — and where festive offers ("flat 50% off making charges") deliver genuine value. Silver and fashion jewellery follow normal e-commerce discounting, with 60–80% off common on brands like Giva and Zavya during sales.

Buy gold and diamond pieces during Akshaya Tritiya, Dhanteras and wedding-season promotions, when making-charge waivers peak.`
  },

  'bags-luggage': {
    intro: `Luggage is one of e-commerce's most reliably discounted categories: American Tourister, Safari and Skybags trolley sets sell at 60–75% off so consistently that paying near MRP is simply a mistake. Real differentiation is in the details — polycarbonate vs polypropylene shells, warranty length, and whether the "set of 3" price beats buying sizes separately (it usually does).

Backpacks and handbags follow fashion-sale cycles instead; Wildcraft and Skybags backpacks under ₹1,000 are a recurring loot-level deal worth waiting for.`
  },

  'beauty': {
    intro: `Beauty and personal care is the stack-happiest category in Indian e-commerce: Nykaa, Amazon, Myntra Beauty, Purplle and Tira layer brand offers, coupon codes, free gifts and payment discounts simultaneously. Effective prices of 40–60% below MRP on mainstream brands are achievable most weeks — the skill is sequencing the stack, which our deal notes spell out.

Nykaa's Pink Friday (November) and its anniversary sale are the genuine deep-discount events; grooming appliances (trimmers, dryers) instead follow electronics-style flash pricing on Amazon and Flipkart. Check expiry-sensitive items (sunscreen, actives) for manufacture dates on arrival.`,
    faqs: [
      { q: 'Is heavily discounted branded makeup genuine?', a: 'On Nykaa, Tira, Purplle and platform-official brand stores, yes — steep discounts are brand-funded promotions. Avoid third-party marketplace sellers with prices far below every official channel; that is the counterfeit red flag.' }
    ]
  },

  // ── Home leaves ─────────────────────────────────────────────────────────────
  'home-kitchen': {
    intro: `Kitchenware is the best loot-deal hunting ground in Indian e-commerce: branded cookware (Prestige, Pigeon, Milton, Cello) rotates through 60–80% discounts continuously, and ₹99–₹499 steals on genuinely useful items appear daily. These are usually lightning deals on limited stock — the fastest-expiring deals we track — so the verified timestamp on each listing matters.

For big-ticket kitchen appliances (mixers, air fryers, dishwashers), festive sales are the honest low; air fryers in particular have fallen 40% year-over-year as the category commoditises.`
  },

  'furniture': {
    intro: `Furniture carries e-commerce's biggest absolute savings — ₹10,000–₹40,000 off on wardrobes, sofas and beds during the Diwali window, when Amazon, Flipkart, Pepperfry and Wakefit all compete on the same festival budgets. Engineered-wood pieces discount hardest; solid wood (Sheesham) holds value and discounts ~20–30% at best.

Mattresses are their own game: Wakefit, Sleepwell and The Sleep Company sell direct with trial periods, and their sale prices beat marketplace listings. Always check delivery-plus-assembly terms — "free installation" is worth ₹1,000–₹3,000 and our deal notes flag when it's included.`
  },

  'garden': {
    intro: `Gardening supplies online are dramatically cheaper than local nurseries for everything non-living: planters, potting mix, seeds, drip kits and grow bags run 50–70% below nursery prices, with frequent ₹99–₹299 multi-pack deals. Monsoon onset (June–July) brings the year's best seed and sapling promotions, timed to planting season.

Balcony-garden starter bundles are the standout value — complete kits at prices below the cost of their pots alone offline.`
  },

  'tools': {
    intro: `Power tools and home-improvement gear discount in a pattern imported from industrial pricing: Bosch, Black+Decker and Stanley sets at 40–60% off appear steadily year-round, not just in festivals. Drill-machine combo kits under ₹2,500 and 100+ piece tool sets under ₹1,500 are the recurring benchmark deals worth waiting for.

Check corded vs cordless carefully at low prices — cordless deals under ₹2,000 usually mean a single low-capacity battery, and a second battery can cost half the kit.`
  },

  'pet-supplies': {
    intro: `Pet food is a subscription-style spend where a 20% saving compounds forever. The pattern: large bags always beat small ones per kilo, marketplace repeat-delivery discounts (Amazon Subscribe & Save) stack another 5–10%, and Heads Up For Tails, Supertails and Zigly run first-order codes worth 15–20%. Royal Canin, Pedigree and Drools large packs hit genuine lows during monthly pet-care sale events.

Toys, grooming and accessories follow loot-deal patterns instead — ₹99–₹199 steals appear weekly.`
  },

  // ── Daily-needs leaves ──────────────────────────────────────────────────────
  'grocery': {
    intro: `Staples pricing online follows a monthly rhythm: super-saver events in the first week (BigBasket, Amazon Fresh, JioMart), mid-month top-up offers, and payment-method cashbacks that refresh on the 1st. Rice, atta, oil and dry fruits in large packs during these windows run 15–25% below kirana prices; the same items mid-month at small pack sizes often don't beat the kirana at all.

Quick-commerce (Blinkit, Zepto, Instamart) trades price for speed — but their app-exclusive coupon drops occasionally undercut everyone, and we list those when they appear. Dry fruits and ghee are the highest-margin items, and the ones where sale timing saves the most.`,
    faqs: [
      { q: 'Is online grocery actually cheaper than my local kirana?', a: 'For monthly staples bought in large packs during sale events, yes — typically 15–25% cheaper. For small everyday top-ups at regular price, the kirana often wins. Split your shopping accordingly.' }
    ]
  },

  'food-dining': {
    intro: `Food delivery discounts moved from blanket coupons to targeted ones — but three routes still reliably cut 20–40%: bank and UPI offers refreshed weekly (the biggest single lever on Swiggy/Zomato), one-time-use new-restaurant coupons, and membership programmes (Swiggy One, Zomato Gold) that pay for themselves within 3–4 orders on delivery fees alone.

Dining-out savings are actually deeper than delivery: EazyDiner, Zomato's dining offers and bank dining programmes stack up to flat 25–40% off restaurant bills.`
  },

  'health': {
    intro: `Medicines and supplements carry structural online discounts: Tata 1mg, PharmEasy and Netmeds run 15–25% off prescription medicines as their normal pricing, with first-order and returning-user codes pushing higher. Supplements (protein, vitamins) discount hardest on brand-official marketplace stores during month-start sales — 40–50% off whey protein MRPs is the honest benchmark, since supplement MRPs are heavily inflated.

Buy authenticity-sensitive items (protein especially) only from brand-official or platform-fulfilled listings; our deals link only to those. Devices like BP monitors and glucometers follow electronics-style festive pricing.`,
    faqs: [
      { q: 'Are online pharmacy discounts on prescription medicines legitimate?', a: 'Yes — Tata 1mg, PharmEasy and Netmeds are licensed pharmacies; the 15–25% discount is their standard model versus MRP-bound offline chemists. You upload the same prescription you would show offline.' }
    ]
  },

  'baby': {
    intro: `Diapers are the deal that matters here: they are a fixed monthly spend where jumbo-pack sale pricing runs 30–45% below small-pack MRP. FirstCry's rotating brand days, Amazon's Subscribe & Save and month-start supermarts are the three levers; per-diaper price is the only number worth comparing, and our deal notes calculate it for you.

Everything else — toys, clothes, gear — follows festive cycles, with FirstCry's Boss Sale and platform baby days delivering genuine 50%+ cuts. Car seats and strollers see their real discounts during international-brand clearances.`
  },

  'toys': {
    intro: `Toys have two honest discount seasons in India — the Diwali gifting window and the quiet post-exam early-summer clearance (April–May) — plus a permanent undercurrent of loot pricing on board games and building sets. LEGO rarely discounts beyond 25% except during platform festive events; Indian brands and Funskool clear at 50–70% routinely.

The recurring steal: branded board games (Monopoly, UNO, Jenga) under ₹300 and STEM kits at half price. These appear weekly and sell out in hours.`
  },

  // ── Lifestyle leaves ────────────────────────────────────────────────────────
  'sports': {
    intro: `Sports and fitness gear discounts follow a January spike (resolution season brings the year's best equipment deals — treadmills, dumbbells, yoga gear) and steady clearance cycles the rest of the year. Decathlon's clearance section, Amazon's fitness sales and brand days on cricket gear each behave differently: Decathlon marks down honestly but shallowly; marketplace listings swing 40–60% on inflated MRPs.

Cricket equipment discounts best right after the IPL ends; gym-at-home gear (adjustable dumbbells, benches) bottoms in January and again during Diwali sales.`
  },

  'automotive': {
    intro: `Car and bike accessories are a high-margin category where online prices routinely run half of what local accessory shops charge — dashcams, seat covers, air compressors, riding gear and cleaning kits all discount 40–70% on marketplaces. Helmets are the standout: ISI-marked Vega, Steelbird and Studds at ₹800–₹1,500 online versus ₹1,500–₹2,500 offline.

Engine oils and batteries need seller care — buy only brand-authorised listings for warranty validity, which is what our deals link to. Tyre and battery deals peak during monsoon-prep promotions (May–June).`
  },

  'books': {
    intro: `Books online in India are permanently 20–40% below MRP, with the deepest cuts on backlist titles and box sets — a complete series regularly costs less than half its component prices. Amazon's book sales (usually quarterly) and Flipkart's Big Billion book section are the events; secondhand-adjacent steals come from publisher clearances, where hardcovers drop under ₹200.

Competitive-exam and textbook buyers: new editions release April–June, and previous editions crash 60–70% immediately after — often with negligible content change. Kindle deals run separately, with ₹49–₹99 daily deals on bestsellers.`
  },

  'stationery': {
    intro: `Office and school supplies bought online in bulk packs run 30–50% below stationery-shop prices — the gap is widest on printer ink and toner, notebooks in multi-packs, and art supplies. The back-to-school window (May–June) brings the year's best bundle deals.

Parker and premium pen gift sets are a hidden recurring deal, frequently at 40–50% off around festive and corporate-gifting seasons. Printer buyers: check the deal notes for ink-tank vs cartridge economics — a cheaper printer with cartridge ink usually costs more within a year.`
  },

  'music': {
    intro: `Musical instruments have thin but real online discounts: 15–30% on guitars, keyboards and ukuleles versus music-store prices, with the honest lows during festive sales. Entry-level bundles (guitar + bag + picks + tuner) are where marketplaces genuinely beat offline stores.

Yamaha, Casio and Juarez keyboards discount most reliably; branded guitars (Fender, Ibanez entry lines) see their best India prices during Amazon's festive events. Check seller authorisation for warranty on anything above ₹10,000 — our deals link authorised listings only.`
  },

  'travel': {
    intro: `Travel deals expire faster than anything else we list — fare sales last 48–72 hours — so the verified timestamp on each deal here matters most. The reliable rhythms: airline flash sales announce midweek (Tuesday–Thursday), hotel prices drop 20–40% booked 3+ weeks ahead in off-peak months, and IRCTC-adjacent bus/train booking apps run first-booking codes worth ₹100–₹300.

The biggest structural saving isn't a coupon at all: paying for travel through bank travel portals and card offers (10–15% instant off on specific cards, refreshed monthly) stacks with sale fares. We list the current card-route on every travel deal.`
  },

  'entertainment': {
    intro: `Nobody should pay sticker price for OTT in India. The routes, in order of savings: telecom bundles (Jio, Airtel and Vi plans bundle Netflix, Prime and Hotstar at effectively 50–80% off), annual plans versus monthly (30–40% cheaper), and platform gift-card routes that add another 5%+ off. Prime's value stacks across shopping + video + music, which changes its math entirely.

Standalone subscription deals (Sony LIV, Zee5 annual passes under ₹599) rotate through the year — the honest lows come during cricket seasons, when platforms compete for the same eyeballs.`
  },

  'bills-recharges': {
    intro: `Bills are the spend everyone has and nobody gets a discount on — recharges, electricity, DTH, broadband, insurance premiums are full price for almost every Indian household. This category exists because there IS a repeatable route to a flat ~5% off all of them: pay via platform gift-card balance bought with the right cashback instrument, and the discount applies to every bill, every month, with no coupon hunting.

The current best method (FD-backed card → 5% back on gift-card purchase → pay any bill from Amazon Pay balance) is documented step-by-step in our featured deal below, including the RBI deposit-insurance facts for anyone wary of new banks. A household paying ₹10,000 a month in bills saves about ₹6,000 a year — for bills they were paying anyway.`,
    faqs: [
      { q: 'Can I really pay electricity and mobile bills at a discount?', a: 'Yes — not from the biller directly, but via gift-card routing: buy an Amazon Pay gift card with an instrument that gives 5% back, then pay any bill (recharge, electricity, DTH, broadband, FASTag, insurance) from that balance. The 5% applies every single time.' },
      { q: 'Is the FD-backed card route safe?', a: 'The card is issued by SBM Bank India, an RBI-licensed bank, and every Indian bank deposit — FD or savings — is insured up to ₹5,00,000 by DICGC, RBI\'s own subsidiary. The ₹2,000 FD stays in your name and earns interest.' },
      { q: 'Why doesn\'t everyone do this?', a: 'Most people simply don\'t know gift-card routing exists, and billers never advertise it because the discount comes from the card/platform side, not from them. Setup takes about 10 minutes once.' }
    ]
  }
};

module.exports = { CATEGORY_CONTENT };
