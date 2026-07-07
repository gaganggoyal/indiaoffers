# IndiaOffers.in v2 — Savings Intelligence Platform

Every deal shows its **true price**: product discount + your bank/card offer + coupon code, stacked into one number. The "Best way to pay" widget ranks every applicable card, UPI and EMI offer so visitors always pay the lowest effective price.

Server-rendered (SEO-first), admin-managed, zero-config to run locally.

## Quick start

```bash
npm install
npm run db:seed    # SQLite at ./data/indiaoffers.db + demo content
npm start          # http://localhost:3000
```

Admin panel: `http://localhost:3000/admin` — `admin@indiaoffers.in / admin123`
(set `ADMIN_PASSWORD` before the first seed in production).

### MySQL in production

```bash
cp .env.example .env                     # DB_DRIVER=mysql + DB_* + real JWT_SECRET
mysql -u root -p < src/db/schema.mysql.sql
npm run db:seed
npm start
```

## Structure

```
src/
├── server.js / app.js        Express assembly (EJS SSR, helmet, cookies)
├── config.js                 env-driven config
├── db/
│   ├── index.js              one query() over better-sqlite3 / mysql2
│   ├── schema.sql            SQLite schema (auto-applied)
│   ├── schema.mysql.sql      MySQL mirror
│   └── seed.js               idempotent demo content
├── services/
│   ├── savings.js            ★ the true-price engine
│   └── tracking.js           outbound click log + affiliate tagging
├── data/
│   ├── taxonomy.js           category tree
│   └── collections.js        ★ SEO landing pages (loot/₹1/free/coupons…)
├── routes/
│   ├── pages.js              public SSR pages + landing pages + sitemap/robots
│   ├── go.js                 /go/d/:id, /go/s/:id redirects
│   ├── api.js                /api/suggest, /api/savings/:id, /api/health
│   └── admin.js              login + CRUD (deals/bank offers/coupons/stores/banners)
├── middleware/auth.js         httpOnly-cookie admin session
└── views/                     EJS templates (public + admin)
public/                        css / js / logo assets
```

## Core concepts

**Savings engine** (`src/services/savings.js`) — for a deal it finds every active
bank offer that applies (store match, min-order, validity window), computes the
discount respecting percent/flat type and max caps, and returns ranked pay
options + the best effective price. Rendered server-side on every deal page and
summarized on every deal card.

**Data model** — `stores`, `deals` (with MRP/price/deal_url/how-to steps),
`bank_offers` (bank, instrument, percent|flat, cap, min order, store scope,
validity), `coupons`, `banners`, `clicks`, `admins`.

**Tracking** — every "Grab this deal" goes through `/go/d/:id`: click logged with
IP/UA/referrer, Amazon `tag=`/Flipkart `affid=` appended automatically, 302 to
the merchant.

**SEO** — full SSR, slug URLs (`/deal/samsung-galaxy-m35-5g-8gb-128gb`),
per-page meta + OpenGraph + keywords, JSON-LD (Product, Breadcrumb, ItemList,
FAQPage, WebSite, Organization), dynamic `/sitemap.xml` and `/robots.txt`.

## SEO landing pages (loot deals, ₹1 deals, coupons…)

High-intent, keyword-targeted pages that people actually search for. They are
**data-driven** from `src/data/collections.js` and registered automatically in
`src/routes/pages.js` — each has its own optimized title/H1/meta/keywords, intro
copy, a matching deal grid, an FAQ block (also emitted as `FAQPage` JSON-LD), and
cross-links to sibling pages. Many alias slugs **301-redirect** to the canonical
page so link equity never splits (e.g. `/loot`, `/re-1-deals`, `/1-rupee-deals`,
`/freebies`, `/coupon-codes`, `/lightning-deals`).

### How each page gets its deals

You **never** manually assign a deal to a page. Every page runs a live query over
the `deals` table (or `coupons` table) and auto-collects whatever matches its
rule — so a deal appears the moment you save it in `/admin` with the right fields.

| Page (+ aliases)         | A deal appears when…                    | Admin field to set          |
|--------------------------|-----------------------------------------|-----------------------------|
| `/loot-deals`            | Badge = `LOOT` **or** price ≤ 30% of MRP (70%+ off) | **Badge** = LOOT, or low **Price** vs **MRP** |
| `/rupee-1-deals`         | price between 0 and 1                    | **Price** = `1`             |
| `/free-deals`            | price ≤ 0                                | **Price** = `0`             |
| `/steal-deals`           | price ≤ 20% of MRP (80%+ off)            | low **Price** vs **MRP**    |
| `/under-99-deals`        | price between 1 and 99                   | **Price** ≤ 99              |
| `/flash-deals`           | `is_trending` is on                      | **Trending** checkbox       |
| `/cashback-deals`        | cashback text is filled                  | **Cashback note**           |
| `/coupons`               | pulls from the `coupons` table           | add via `/admin/coupons`    |

The two main levers are **Badge** (put a deal on `/loot-deals` explicitly) and
**Price + MRP** (drives ₹1, free, under-99, steal, and the discount half of
loot automatically). One deal can appear on several pages at once — e.g. MRP
₹2,000 / Price ₹1 / Badge LOOT / Trending shows on loot, ₹1, under-99, steal and
flash simultaneously. **Always fill MRP** — the loot/steal discount math needs it
(a `LOOT` badge still forces the loot page even without MRP).

Add a new zone by appending one config object to `src/data/collections.js`
(`slug`, `aliases`, `title`, `h1`, `description`, `keywords`, `intro`, `where`,
`order`, `faqs`); the route and sitemap entry are wired up automatically.

## Admin

Everything on the site is content-managed at `/admin`:
- **Deals** — prices, image, merchant URL, how-to steps, badges, expiry; the edit page previews the live savings stack
- **Bank offers** — bank, instrument, discount type/value/cap, min order, store scope, validity window
- **Coupons, Stores, Banners** — full CRUD
- Dashboard shows live counts + top deals by outbound clicks

## Roadmap (not built yet)

- Price-history tracking + drop alerts (email/Telegram)
- User accounts, watchlists
- Cashback wallet (v1 tracking pixel code is in git history at tag/commit `620967d`)
- Community deal submissions
