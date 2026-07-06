'use strict';

/**
 * Quick-add deal service.
 *
 * Admin pastes an Amazon product link + MRP + deal price; we fetch the live page
 * for its product title, tidy that title into a short shopper-friendly headline
 * with Gemini (optional), classify it into one of our category slugs, and hand
 * back a ready-to-publish deal object. The route prefixes "[LOOT]" and inserts it
 * live in one shot.
 *
 * Everything degrades gracefully: no Gemini key (or an API hiccup) simply falls
 * back to a rule-based title clean-up and a blank category — the deal still
 * publishes with a sensible name.
 */

const { CATEGORY_SLUGS, CATEGORY_MAP } = require('../data/taxonomy');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

// ── Amazon link handling ─────────────────────────────────────────────────────
function isAmazonUrl(u) {
  try { return /(^|\.)amazon\.(in|com)$|(^|\.)amzn\.to$/i.test(new URL(u).hostname); }
  catch { return false; }
}

// Canonicalise to a clean https://www.amazon.in/dp/ASIN when we can find an ASIN;
// otherwise return the URL stripped of query noise. We deliberately do NOT append
// an affiliate tag here — the outbound /go redirect tags every click with the
// store's authoritative affiliate_params (see services/tracking.js), so adding a
// tag now would only be overwritten (and could hardcode the wrong one).
function canonicalAmazon(finalUrl) {
  const asin = (finalUrl.match(/\/(?:dp|gp\/product|gp\/aw\/d|d|product)\/([A-Z0-9]{10})(?:[/?]|$)/i) || [])[1];
  if (asin) return `https://www.amazon.in/dp/${asin.toUpperCase()}`;
  try { const u = new URL(finalUrl); return u.origin + u.pathname; } catch { return finalUrl; }
}

// Strip Amazon's boilerplate off a raw <title> string.
function cleanRawTitle(raw) {
  return String(raw || '')
    .replace(/\s*[:|-]\s*Amazon\.(in|com).*$/i, '')       // " : Amazon.in: Electronics"
    .replace(/^\s*(?:Buy|Amazon\.(?:in|com)\s*:?\s*Buy)\s+/i, '') // "Amazon.in: Buy ..."
    .replace(/\s+online.*$/i, '')                          // "... online at low prices ..."
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Decode the handful of HTML entities Amazon uses inside attributes/JSON.
function decodeEntities(s) {
  return String(s).replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/gi, "'").replace(/&amp;/g, '&');
}

/**
 * Pull the main product image straight from the Amazon page we already fetched.
 * Amazon serves the same picture through several carriers depending on the page
 * variant, so we try them in order of quality and fall back to the largest image
 * on the CDN. Returns a real m.media-amazon.com URL, or null if none is found —
 * far more reliable than asking a text model to "find an image link" (which just
 * hallucinates URLs that 404).
 */
function extractImage(html) {
  if (!html) return null;
  // 1. Explicit hi-res attribute on the main image.
  let m = html.match(/data-old-hires=["'](https:\/\/[^"']+)["']/i);
  if (m && /media-amazon|images-/.test(m[1])) return m[1];

  // 2. data-a-dynamic-image: an entity-encoded JSON map of {url: [w,h]}. Pick widest.
  m = html.match(/data-a-dynamic-image=["'](\{.*?\})["']/i);
  if (m) {
    try {
      const map = JSON.parse(decodeEntities(m[1]));
      let best = null, bestW = -1;
      for (const [url, dims] of Object.entries(map)) {
        const w = Array.isArray(dims) ? (+dims[0] || 0) : 0;
        if (w > bestW) { bestW = w; best = url; }
      }
      if (best) return best;
    } catch { /* fall through */ }
  }

  // 3. ImageBlock JSON keys.
  for (const key of ['hiRes', 'large', 'mainUrl']) {
    m = html.match(new RegExp('"' + key + '"\\s*:\\s*"(https:[^"]+)"', 'i'));
    if (m && /media-amazon|images-/.test(m[1])) return m[1].replace(/\\u002F/gi, '/');
  }

  // 4. The landing <img> src.
  m = html.match(/id=["']landingImage["'][\s\S]{0,500}?src=["'](https:\/\/[^"']+)["']/i);
  if (m && /media-amazon|images-/.test(m[1])) return m[1];

  // 5. Last resort: the first sized product image on the CDN (skips tiny sprites).
  m = html.match(/https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9_+%-]+\._[A-Za-z0-9_,]*_\.(?:jpg|png|webp)/i);
  return m ? m[0] : null;
}

// Fallback title tidy when Gemini is unavailable: keep it readable and short.
function shortenTitle(raw, max = 90) {
  let t = cleanRawTitle(raw);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = Math.max(cut.lastIndexOf(','), cut.lastIndexOf(' '), cut.lastIndexOf('|'));
  return (at > 40 ? cut.slice(0, at) : cut).replace(/[,\s|]+$/, '').trim() + '…';
}

const BROWSER_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
  'sec-ch-ua': '"Chromium";v="125", "Not.A/Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"'
};
const ROBOT_RE = /Type the characters you see|To discuss automated access|Robot Check|Enter the characters you see below|api-services-support@amazon/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchOnce(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: BROWSER_HEADERS });
    const html = await res.text();
    return { finalUrl: res.url || url, html };
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Amazon took too long to respond — try again' : 'Could not reach Amazon for this link');
  } finally { clearTimeout(timer); }
}

/**
 * Fetch the Amazon page and pull out its <title>. Follows amzn.to redirects.
 * Amazon occasionally serves a robot-check to automated requests; we retry once
 * after a short pause before giving up with a clear, user-fixable message.
 */
async function fetchAmazonTitle(url) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await sleep(900);
    const { finalUrl, html } = await fetchOnce(url);
    if (ROBOT_RE.test(html) && html.length < 60000) { last = 'robot'; continue; }  // captcha page is tiny
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const raw = m ? m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim() : '';
    if (raw && !/^amazon\.(in|com)$/i.test(raw)) return { raw, finalUrl, html };
    last = 'empty';
  }
  throw new Error(last === 'robot'
    ? 'Amazon served a robot-check for this link — open it once in your browser, then retry (or try again in a minute)'
    : 'Could not read a product title from that page — check the link');
}

// ── Gemini title refinement (optional) ───────────────────────────────────────
async function refineWithGemini(rawTitle) {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) return null;                                   // no key → caller falls back
  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  const slugs = CATEGORY_SLUGS.join(', ');

  const prompt =
    'You clean up Amazon India product titles for a deals website.\n' +
    'Given the raw page title below, return JSON with:\n' +
    '  "title": a concise, human product name — brand + model + at most one or two key specs, ' +
    'max ~80 characters, Title Case, NO marketing phrases, NO "Amazon", NO color/SKU codes, NO trailing punctuation.\n' +
    '  "category": exactly one slug from this list that best fits, or "" if none fit: ' + slugs + '\n\n' +
    'Raw title: ' + rawTitle;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: { title: { type: 'STRING' }, category: { type: 'STRING' } },
              required: ['title', 'category']
            }
          }
        })
      }
    );
    if (!res.ok) { console.warn('[quickdeal] Gemini HTTP', res.status, (await res.text()).slice(0, 200)); return null; }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    const out = JSON.parse(text);
    const title = String(out.title || '').trim();
    let category = String(out.category || '').trim().toLowerCase();
    if (!CATEGORY_MAP[category]) category = '';            // ignore anything off-list
    return title ? { title, category } : null;
  } catch (e) {
    console.warn('[quickdeal] Gemini refine failed:', e.message);
    return null;
  } finally { clearTimeout(timer); }
}

/**
 * Orchestrate: link → { title, category, dealUrl, source }.
 * `title` is the clean product name WITHOUT the [LOOT] prefix (the route adds it).
 */
async function buildFromLink(url) {
  if (!url || !isAmazonUrl(url)) throw new Error('Please paste a valid Amazon product link (amazon.in / amzn.to)');
  const { raw, finalUrl, html } = await fetchAmazonTitle(url);
  const refined = await refineWithGemini(raw);
  const title = refined ? refined.title : shortenTitle(raw);
  const category = refined ? refined.category : '';
  return { title, category, image: extractImage(html), dealUrl: canonicalAmazon(finalUrl), rawTitle: raw, usedAi: !!refined };
}

function geminiConfigured() { return !!(process.env.GEMINI_API_KEY || '').trim(); }

module.exports = { buildFromLink, isAmazonUrl, geminiConfigured };
