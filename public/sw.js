/* IndiaOffers.in — service worker (makes the site installable + offline-tolerant).
 *
 * Strategy, kept deliberately conservative so it can never serve stale prices:
 *   • Page navigations → network-first; on failure fall back to the last cached
 *     copy of that page, then to a branded offline page.
 *   • Static assets (css/js/img/manifest) → stale-while-revalidate: instant from
 *     cache, refreshed in the background.
 *   • Only same-origin GET is handled. Admin, outbound /go redirects, and
 *     non-GET requests are ignored entirely (always hit the network).
 */
'use strict';

const VERSION = 'io-v1';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ['/offline.html', '/css/site.css', '/js/site.js', '/img/logo-icon.png', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = url => /\.(css|js|png|jpg|jpeg|webp|svg|gif|ico|woff2?)$/i.test(url.pathname) || url.pathname === '/manifest.webmanifest';

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                 // third-party → untouched
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/go/')) return;

  // Static assets: stale-while-revalidate.
  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC).then(cache =>
        cache.match(req).then(cached => {
          const network = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Page navigations: network-first, fall back to cache, then offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => { if (res.ok) caches.open(PAGES).then(c => c.put(req, res.clone())); return res; })
        .catch(() => caches.match(req).then(hit => hit || caches.match('/offline.html')))
    );
  }
});
