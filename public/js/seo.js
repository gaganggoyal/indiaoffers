/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  IndiaOffers.in — SEO Module
 *  Handles dynamic <title>/<meta>/canonical updates as the SPA navigates,
 *  plus JSON-LD structured data injection for rich snippets.
 *
 *  NOTE: For true SEO (crawlable by Googlebot without JS execution issues),
 *  pair this with server-side rendering or prerendering (see notes at bottom).
 * ═══════════════════════════════════════════════════════════════════════════
 */

const SEO_CONFIG = {
  siteName : 'IndiaOffers.in',
  baseUrl  : 'https://indiaoffers.in',
  defaultTitle : 'IndiaOffers.in - India\'s #1 Cashback & Coupons Website | Save on 2000+ Stores',
  defaultDesc  : 'Get the best cashback offers, coupon codes & deals on Amazon, Flipkart, Myntra & 2000+ top stores. Join 50 Lakh+ users saving money with IndiaOffers.in. Sign up & get ₹100 bonus!',
  defaultImage : 'https://indiaoffers.in/og-image.jpg',
  twitterHandle: '@IndiaOffersIn'
};

const SEO_PAGES = {
  'home': {
    title: SEO_CONFIG.defaultTitle,
    desc : SEO_CONFIG.defaultDesc
  },
  'stores': {
    title: 'All Stores - Cashback & Coupons on 2000+ Brands | IndiaOffers.in',
    desc : 'Browse cashback offers from Amazon, Flipkart, Myntra, Nykaa & 2000+ top Indian and global stores. Compare cashback rates and shop smart.'
  },
  'deals': {
    title: 'Today\'s Best Deals & Coupon Codes | IndiaOffers.in',
    desc : 'Discover today\'s top deals, discount coupons and cashback offers across electronics, fashion, food delivery, travel and more.'
  },
  'blog': {
    title: 'Money Saving Tips & Shopping Guides | IndiaOffers.in Blog',
    desc : 'Read expert tips on saving money, maximizing cashback, and getting the best deals while shopping online in India.'
  },
  'help': {
    title: 'Help Center & FAQs | IndiaOffers.in',
    desc : 'Get answers to frequently asked questions about cashback tracking, withdrawals, coupon codes and more on IndiaOffers.in.'
  },
  'about': {
    title: 'About Us | IndiaOffers.in',
    desc : 'Learn about IndiaOffers.in, India\'s trusted cashback and coupons platform helping millions of users save money since 2024.'
  },
  'top-earners': {
    title: 'Top Cashback Earners Leaderboard | IndiaOffers.in',
    desc : 'See India\'s top cashback earners this month. Join IndiaOffers.in and start earning real cashback on every purchase.'
  },
  'tracking': {
    title: 'Track Your Cashback Orders | IndiaOffers.in',
    desc : 'Track the real-time status of your cashback orders placed through IndiaOffers.in across all partner stores.'
  },
  'missing-cashback': {
    title: 'Claim Missing Cashback | IndiaOffers.in',
    desc : 'Didn\'t receive your cashback? Submit a claim and our team will investigate and resolve it within 7 days.'
  },
  'contact': {
    title: 'Contact Us | IndiaOffers.in',
    desc : 'Get in touch with the IndiaOffers.in support team for any questions about cashback, deals, or your account.'
  },
  'partner': {
    title: 'Partner With Us | IndiaOffers.in Merchant Program',
    desc : 'Grow your sales with IndiaOffers.in. Partner as a merchant and reach 50 Lakh+ active shoppers across India.'
  },
  'terms': { title: 'Terms of Service | IndiaOffers.in', desc: 'Read the Terms of Service governing your use of IndiaOffers.in.' },
  'privacy': { title: 'Privacy Policy | IndiaOffers.in', desc: 'Learn how IndiaOffers.in collects, uses and protects your personal data.' },
};

/**
 * Update document <title>, meta description, canonical URL, and OG/Twitter tags
 * Call this from navigate() whenever the SPA view changes.
 */
function updateSEOForView(view, customData) {
  const page = customData || SEO_PAGES[view] || {
    title: `${view.charAt(0).toUpperCase() + view.slice(1)} | ${SEO_CONFIG.siteName}`,
    desc : SEO_CONFIG.defaultDesc
  };

  document.title = page.title;
  setMetaContent('description', page.desc);
  setMetaContent('og:title', page.title, true);
  setMetaContent('og:description', page.desc, true);
  setMetaContent('og:url', SEO_CONFIG.baseUrl + (view === 'home' ? '' : '/' + view), true);
  setMetaContent('og:image', page.image || SEO_CONFIG.defaultImage, true);
  setMetaContent('twitter:title', page.title);
  setMetaContent('twitter:description', page.desc);

  // Canonical link
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = SEO_CONFIG.baseUrl + (view === 'home' ? '/' : '/' + view);
}

function setMetaContent(name, content, isProperty) {
  const attr = isProperty ? 'property' : 'name';
  let tag = document.querySelector(`meta[${attr}="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * Build SEO data for a specific store page (called from renderStoreDetail)
 */
function updateSEOForStore(store) {
  if (!store) return;
  updateSEOForView('store-detail', {
    title: `${store.name} Coupons & Cashback Offers - Up to ${store.cashback} | IndiaOffers.in`,
    desc : `Get ${store.cashback} cashback on ${store.name}. Latest coupon codes, deals and offers. ${store.totalUsers ? store.totalUsers.toLocaleString('en-IN') + '+ users trust IndiaOffers.in.' : ''}`,
    image: store.logo || SEO_CONFIG.defaultImage
  });
  injectStoreJsonLd(store);
}

/**
 * Build SEO data for a specific deal page
 */
function updateSEOForDeal(deal, store) {
  if (!deal) return;
  updateSEOForView('deal-detail', {
    title: `${deal.title} - ${deal.code} Coupon Code | IndiaOffers.in`,
    desc : `${deal.desc} Use code ${deal.code} and get ${deal.cashback} cashback at ${store ? store.name : 'this store'}.`,
    image: deal.image || SEO_CONFIG.defaultImage
  });
  injectOfferJsonLd(deal, store);
}

/**
 * Inject JSON-LD structured data for a Store (Organization + AggregateOffer)
 */
function injectStoreJsonLd(store) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type'   : 'Store',
    'name'    : store.name,
    'url'     : `https://${store.url}`,
    'image'   : store.logo || SEO_CONFIG.defaultImage,
    'aggregateRating': {
      '@type'      : 'AggregateRating',
      'ratingValue': store.rating || 4.3,
      'reviewCount': store.totalUsers || 1000
    }
  };
  injectJsonLd('store-jsonld', jsonLd);
}

/**
 * Inject JSON-LD for a coupon/deal (DiscountOffer / Coupon schema)
 */
function injectOfferJsonLd(deal, store) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type'   : 'Offer',
    'name'        : deal.title,
    'description' : deal.desc,
    'url'         : `${SEO_CONFIG.baseUrl}/deal/${deal.id}`,
    'priceCurrency': 'INR',
    'seller': {
      '@type': 'Organization',
      'name' : store ? store.name : ''
    },
    'validThrough': deal.expiry || undefined
  };
  injectJsonLd('offer-jsonld', jsonLd);
}

function injectJsonLd(id, data) {
  let script = document.getElementById(id);
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

/**
 * Handle browser back/forward buttons (popstate)
 */
window.addEventListener('popstate', (e) => {
  const view = (e.state && e.state.view) || (location.pathname === '/' ? 'home' : location.pathname.slice(1));
  if (typeof navigate === 'function') navigate(view, false);
});

/**
 * On initial load, sync the view to the current URL path (deep-linking support)
 */
function initSEORouting() {
  const path = location.pathname;
  const view = path === '/' || path === '' ? 'home' : path.replace(/^\//, '');
  const validViews = Object.keys(SEO_PAGES).concat([
    'store-detail', 'deal-detail', 'dashboard', 'cashbacks', 'wallet', 'favorites',
    'referrals', 'profile', 'careers', 'press', 'cookie', 'refund', 'sitemap', 'admin'
  ]);
  if (validViews.includes(view) && typeof navigate === 'function') {
    navigate(view, false);
  } else {
    updateSEOForView('home');
  }
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 *  PRODUCTION SEO NOTES
 * ═══════════════════════════════════════════════════════════════════════════
 *  This is a client-rendered SPA. While the above script keeps <title>,
 *  meta tags, and JSON-LD in sync for users and social-share crawlers that
 *  execute JS (Googlebot does, mostly), for best results also:
 *
 *  1. Generate a real sitemap.xml from your `deals`/`stores`/`blog_posts`
 *     tables (see schema.sql sitemap_urls VIEW) and submit to Search Console.
 *  2. Add a robots.txt allowing crawl + pointing to sitemap.xml.
 *  3. Consider prerendering critical pages (home, top stores, top deals)
 *     to static HTML via a build step (e.g. Puppeteer-based prerender,
 *     or migrate high-traffic pages to Next.js/SSR for true server rendering).
 *  4. Ensure each store/deal has a unique, descriptive URL slug
 *     (e.g. /store/amazon, /deal/flipkart-70-off-electronics) instead of
 *     opaque IDs, for better keyword targeting.
 * ═══════════════════════════════════════════════════════════════════════════
 */
