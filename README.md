# IndiaOffers.in — Cashback & Coupons Platform

A complete CashKaro-style cashback/coupons platform: SEO-optimized frontend, Node.js/Express backend, MySQL schema, and a full sale-tracking system covering (1) Amazon, (2) Flipkart, and (3) any generic Shopify/WooCommerce/custom merchant via a universal JS pixel.

## 📁 Project Structure

```
indiaoffers/
├── public/                      ← Frontend (deploy to your web server / CDN)
│   ├── index.html                  SEO-optimized SPA (your original app, patched)
│   ├── robots.txt
│   ├── sitemap.xml                 (auto-generated, see generate-sitemap.js)
│   ├── css/styles.css
│   └── js/
│       ├── seo.js                  Dynamic meta/JSON-LD per SPA view
│       └── app-original.js         Your original app logic (patched for real tracking)
├── tracking/
│   └── pixel.js                    Universal tracking pixel — give this to ANY merchant
├── shopify-pixel/
│   └── shopify-integration.html    Copy-paste snippet + guide for Shopify merchants
├── affiliate/
│   ├── amazon-tracker.js           Amazon Associates: URL tagging + report reconciliation
│   └── flipkart-tracker.js         Flipkart Affiliate: URL tagging + real-time postback
├── server.js                       Express API: redirects, pixel endpoint, postbacks, auth, admin
├── schema.sql                      MySQL schema — run once to set up your DB
├── generate-sitemap.js             Cron job to rebuild sitemap.xml from live data
├── package.json
└── .env.example                    Copy to .env and fill in real credentials
```

## 🚀 Quick Start (zero-config — SQLite)

```bash
npm install
npm run db:seed   # creates ./data/indiaoffers.db + demo accounts, 22 stores, 30 deals
npm start         # http://localhost:3000 — full working site
```

Demo logins: `user@demo.com / user123` · admin: `admin@indiaoffers.in / admin123`

The Express server serves `/public` as static files AND exposes the tracking/API routes, so `http://localhost:3000` gives you the full working site.

### Production with MySQL

```bash
cp .env.example .env           # set DB_DRIVER=mysql + DB_* credentials + real JWT_SECRET
mysql -u root -p < schema.sql  # creates the `indiaoffers` database + tables
npm run db:seed                # same seeder works for both drivers
npm start
```

`db.js` exposes one `query(sql, params)` interface over both drivers — all
application SQL is portable.

### Architecture (rebuilt)

- **`db.js`** — real database layer (better-sqlite3 by default, mysql2 pool with `DB_DRIVER=mysql`). The old fake `db` stub is gone.
- **`seed.js`** — idempotent seeder (stores, deals, demo users with bcrypt hashes, demo pixel merchant `m_demo`).
- **`server.js`** — full REST API: auth (JWT), `/api/bootstrap`, `/api/user/me`, orders, claims, withdrawals (atomic balance guard), favorites, notifications, admin panel endpoints (advance order, approve claims/withdrawals, store/deal CRUD), plus all tracking routes. Wallet is credited when an order reaches **confirmed**.
- **`public/js/api.js`** — frontend API client; hydrates the SPA's caches from the backend.
- **`public/js/app-api.js`** — overrides every demo mutation (login, order submit, withdraw, admin actions…) with real API calls. The original rendering code in `app-original.js` is untouched.
- **`/pixel.js`** — the universal tracking pixel is served by the app itself; point merchants at `https://your-domain/pixel.js?merchant=ID` (endpoint configurable via `?endpoint=` or `IOPixelConfig.endpoint`).

## 🎯 How Sale Tracking Works (3 mechanisms)

### 1. Amazon (affiliate/amazon-tracker.js)
- Every "Shop Now" click is routed through `GET /go/amazon?url=...`
- We tag the URL with your Associates tag (`?tag=indiaoffers-21`) and set a 90-day `io_click` cookie
- Amazon has **no real-time API** for sales — instead, a daily cron job (06:30 IST, see `server.js`) downloads/parses your Associates **Earnings Report CSV** and matches orders back to clicks within a 90-day window, then credits user wallets automatically (`reconcileAmazonOrders`)
- **You must**: log into Associates Central and either (a) automate CSV download with Playwright, or (b) enable report-by-email and parse the attachment

### 2. Flipkart (affiliate/flipkart-tracker.js)
- Clicks routed through `GET /go/flipkart?url=...`, tagged with `affid` + `affExtParam1` (click ID) + `affExtParam2` (user ID)
- Flipkart **does** support real-time postbacks: set your postback URL in Affiliate Dashboard → Settings to:
  `https://api.indiaoffers.in/postback/flipkart?token=YOUR_FLIPKART_POSTBACK_TOKEN`
- `handleFlipkartPostback()` verifies the token, matches the click, credits the wallet — all within the same request, no cron needed

### 3. Universal Pixel — for Shopify, WooCommerce, or ANY custom site (tracking/pixel.js)
This is what you give to merchants who don't have an affiliate network at all.
- Merchant pastes one `<script>` tag (see `shopify-pixel/shopify-integration.html` for exact Shopify steps) on their **order success / thank-you page**
- The pixel auto-detects Shopify's `window.Shopify.checkout` object, or falls back to WooCommerce DOM elements, or reads `data-order-id`/`data-order-amount` attributes you add to `<body>`
- It reads the `io_click` cookie (set when the user clicked through IndiaOffers) and POSTs `{merchantId, clickId, orderId, orderAmount, ...}` to `POST /track/sale`
- Server validates, dedupes, computes cashback by the merchant's configured rate, and stores a `pixel_sales` row — visible instantly in admin → Order Tracking
- Manual fallback for JS-heavy checkouts: `window.IndiaOffersPixel.track({ orderId, orderAmount, email })`

## 🔍 SEO Work Done

- Full `<title>`, meta description, Open Graph, Twitter Card, canonical tags in `index.html`
- JSON-LD: `Organization`, `WebSite` + `SearchAction`, plus per-page `Store`/`Offer` schema injected dynamically by `seo.js` as users navigate store/deal pages
- `js/seo.js` rewrites `<title>`/meta on every SPA view change (`navigate()` was patched to call `updateSEOForView()`), and pushes real URLs into browser history (`/stores`, `/deals`, `/store/amazon`, etc.) so links are shareable and back/forward works
- `robots.txt` + `generate-sitemap.js` (run via cron) for crawl coverage
- **Important caveat**: this is still a client-rendered single-page app. Googlebot generally executes JS fine, but for maximum ranking on competitive terms ("amazon cashback", "flipkart coupons"), consider migrating top traffic pages (home, top 50 stores, top 200 deals) to server-side rendering or static prerendering — noted in detail at the bottom of `seo.js`.

## 🔐 What You Still Need To Do

1. **Get real affiliate accounts**: Amazon Associates (associate tag), Flipkart Affiliate (affid + postback token), and fill `.env`
2. **Stand up MySQL** and run `schema.sql`
3. **Automate the Amazon report download** — there's no public API, so use Playwright/Puppeteer to log in and download the CSV daily, or use Associates' email-report feature
4. **Deploy** `server.js` behind HTTPS (api.indiaoffers.in) and `public/` behind your main domain (indiaoffers.in) — or serve both from the same Express app as configured
5. **Replace the fake `db` object** in `server.js` / trackers with a real MySQL client (mysql2/promise pool) — query signatures are already written to match standard SQL
6. **Set merchant secret keys**: every Shopify/WooCommerce merchant gets a row in the `merchants` table with a unique `secret_key`; give them their `merchantId` + the pixel snippet from `shopify-pixel/shopify-integration.html`
# indiaoffers
