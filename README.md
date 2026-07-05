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
├── routes/
│   ├── pages.js              public SSR pages + sitemap/robots
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
per-page meta + OpenGraph, Product JSON-LD on deal pages, `/sitemap.xml`,
`/robots.txt`.

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
