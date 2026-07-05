/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  IndiaOffers.in — Universal Sale Tracking Pixel  v2.0
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  INSTALLATION OPTIONS
 *  ─────────────────────────────────────────────────────────────────────────
 *  A) Shopify  →  Admin › Settings › Checkout › "Additional scripts"
 *     <script src="https://cdn.indiaoffers.in/pixel.js
 *                  ?merchant=YOUR_MERCHANT_ID&key=YOUR_SECRET" async></script>
 *
 *  B) WooCommerce  →  Paste in child-theme functions.php or a plugin:
 *     add_action('woocommerce_thankyou', 'io_pixel_inject');
 *     function io_pixel_inject($order_id){ ... }  (see WooCommerce guide)
 *
 *  C) Any custom site  →  Add before </body> on thank-you / order-success page:
 *     <script>
 *       window.IOPixelConfig = {
 *         merchantId: 'YOUR_MERCHANT_ID',
 *         secretKey : 'YOUR_SECRET_KEY'
 *       };
 *     </script>
 *     <script src="https://cdn.indiaoffers.in/pixel.js" async></script>
 *
 *  D) Manual call (JS-heavy SPAs):
 *     window.IndiaOffersPixel.track({
 *       orderId: 'ORD-001', orderAmount: 1999, currency:'INR', email:'x@y.com'
 *     });
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  var PIXEL_VERSION = '2.0.0';
  var DEFAULT_ENDPOINT = 'https://api.indiaoffers.in/track/sale';

  /* ── 1. Config ─────────────────────────────────────────────────────────── */
  function getConfig() {
    var cfg    = window.IOPixelConfig || {};
    var script = document.currentScript || (function () {
      var s = document.getElementsByTagName('script');
      return s[s.length - 1];
    })();
    var src = (script && script.src) ? script.src : '';
    var url;
    try { url = new URL(src, location.href); } catch (e) { url = { searchParams: { get: function () { return ''; } } }; }
    return {
      merchantId : cfg.merchantId || url.searchParams.get('merchant') || '',
      secretKey  : cfg.secretKey  || url.searchParams.get('key')      || '',
      endpoint   : cfg.endpoint   || url.searchParams.get('endpoint') || DEFAULT_ENDPOINT,
      debug      : cfg.debug      || url.searchParams.get('debug') === '1'
    };
  }

  /* ── 2. Click ID (set by indiaoffers.in redirect page) ─────────────────── */
  function getClickData() {
    // Priority: URL param › first-party cookie › localStorage
    var ioClick = new URLSearchParams(location.search).get('io_click');
    if (ioClick) return { clickId: ioClick, src: 'url' };

    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var p = cookies[i].trim().split('=');
      if (p[0] === 'io_click') return { clickId: decodeURIComponent(p[1] || ''), src: 'cookie' };
    }

    try {
      var ls = localStorage.getItem('io_click');
      if (ls) return { clickId: ls, src: 'ls' };
    } catch (e) {}

    return null; // Not an IndiaOffers referral
  }

  /* ── 3. Auto-detect Shopify order ──────────────────────────────────────── */
  function detectShopify() {
    if (window.Shopify && window.Shopify.checkout) {
      var c = window.Shopify.checkout;
      return {
        orderId     : String(c.order_id  || c.order_number || c.id || ''),
        orderAmount : parseFloat(c.total_price || 0),
        currency    : c.currency    || 'INR',
        email       : c.email       || ''
      };
    }
    // Shopify also injects window.meta on checkout pages
    if (window.meta && window.meta.page && window.meta.page.pageType === 'checkout') {
      return null; // Will be available after Shopify.onReady
    }
    return null;
  }

  /* ── 4. Auto-detect WooCommerce / generic HTML ──────────────────────────── */
  function detectPage() {
    var d = document;
    var orderId = '', amount = '', email = '', currency = 'INR';

    // data-* on <body>
    orderId  = d.body.dataset.orderId     || d.body.dataset.orderNumber || '';
    amount   = d.body.dataset.orderAmount || d.body.dataset.orderTotal  || '';
    currency = d.body.dataset.currency    || 'INR';

    // <meta> tags
    if (!orderId) {
      var mId  = d.querySelector('meta[name="order-id"],meta[property="order:id"]');
      var mAmt = d.querySelector('meta[name="order-total"],meta[property="order:total"]');
      if (mId)  orderId = mId.content;
      if (mAmt) amount  = mAmt.content;
    }

    // WooCommerce thank-you page
    if (!orderId) {
      var wooNum = d.querySelector('.woocommerce-order-overview__order strong, .order-number, [class*="order-number"]');
      if (wooNum) orderId = wooNum.textContent.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
    }
    if (!amount) {
      var wooAmt = d.querySelector('.woocommerce-order-overview__total .woocommerce-Price-amount bdi, .order-total .amount');
      if (wooAmt) amount = wooAmt.textContent.replace(/[^0-9.]/g, '');
    }

    // Generic: look for common class names used by page builders
    if (!orderId) {
      var el = d.querySelector('[data-order-id],[data-order-number],[id*="order_number"],[id*="order-number"]');
      if (el) orderId = el.dataset.orderId || el.dataset.orderNumber || el.textContent.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
    }

    if (!orderId) return null;

    // Try to grab customer email
    var eMail = d.querySelector('[data-customer-email], .customer-email, .order-email');
    if (eMail) email = eMail.textContent.trim() || eMail.dataset.customerEmail || '';

    return { orderId: orderId, orderAmount: parseFloat(amount) || 0, currency: currency, email: email };
  }

  /* ── 5. Fire pixel ─────────────────────────────────────────────────────── */
  function fire(cfg, click, order) {
    var payload = {
      v          : PIXEL_VERSION,
      merchantId : cfg.merchantId,
      clickId    : click.clickId,
      clickSrc   : click.src,
      orderId    : order.orderId,
      orderAmount: order.orderAmount,
      currency   : order.currency || 'INR',
      email      : order.email    || '',
      url        : location.href,
      ts         : Date.now()
    };

    // Deduplicate within session
    try {
      var key = 'io_fired_' + order.orderId;
      if (sessionStorage.getItem(key)) {
        if (cfg.debug) console.info('[IO Pixel] Already fired for', order.orderId);
        return;
      }
      sessionStorage.setItem(key, '1');
    } catch (e) {}

    if (cfg.debug) console.info('[IO Pixel] Payload:', payload);

    var body = JSON.stringify(payload);

    // sendBeacon (page-unload safe)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(cfg.endpoint, new Blob([body], { type: 'application/json' }));
    }

    // Fetch (for response + error handling)
    try {
      fetch(cfg.endpoint, {
        method   : 'POST',
        headers  : { 'Content-Type': 'application/json' },
        body     : body,
        keepalive: true
      }).then(function (r) {
        if (cfg.debug) console.info('[IO Pixel] Server responded', r.status);
      }).catch(function (err) {
        // Fallback: image pixel
        var params = Object.keys(payload).map(function (k) {
          return k + '=' + encodeURIComponent(payload[k]);
        }).join('&');
        new Image().src = cfg.endpoint.replace('/sale', '/sale.gif') + '?' + params;
        if (cfg.debug) console.warn('[IO Pixel] fetch failed, image fallback used:', err);
      });
    } catch (e) {}
  }

  /* ── 6. Public API ─────────────────────────────────────────────────────── */
  var IO = window.IndiaOffersPixel = window.IndiaOffersPixel || {};

  // Auto mode
  IO.init = function () {
    var cfg   = getConfig();
    var click = getClickData();
    if (!click) return;                     // Not our referral, skip silently
    if (!cfg.merchantId) { console.warn('[IO Pixel] merchantId missing'); return; }

    var order = detectShopify() || detectPage();
    if (!order) {
      if (cfg.debug) console.info('[IO Pixel] Order not auto-detected. Use IO.track({...})');
      return;
    }
    fire(cfg, click, order);
  };

  // Manual mode for SPAs / custom setups
  IO.track = function (orderData) {
    var cfg   = getConfig();
    var click = getClickData();
    if (!click) return;
    if (!cfg.merchantId) { console.warn('[IO Pixel] merchantId missing'); return; }
    if (!orderData || !orderData.orderId) { console.warn('[IO Pixel] orderId required'); return; }
    fire(cfg, click, orderData);
  };

  /* ── 7. Boot ───────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', IO.init);
  } else {
    IO.init();
  }

})();
