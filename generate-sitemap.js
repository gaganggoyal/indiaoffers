/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  IndiaOffers.in — Sitemap Generator
 *  Run periodically (cron) to regenerate /public/sitemap.xml from live data.
 *
 *  Usage:  node generate-sitemap.js
 *  Cron :  0 3 * * *  cd /app && node generate-sitemap.js   (daily at 3 AM)
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const BASE_URL = 'https://indiaoffers.in';

require('dotenv').config();
const db = require('./db');

async function generateSitemap() {
  const urls = [];

  // Static pages
  const staticPages = [
    { loc: '/',                changefreq: 'daily',   priority: '1.0' },
    { loc: '/stores',          changefreq: 'daily',   priority: '0.9' },
    { loc: '/deals',           changefreq: 'hourly',  priority: '0.9' },
    { loc: '/blog',            changefreq: 'weekly',  priority: '0.7' },
    { loc: '/help',            changefreq: 'monthly', priority: '0.5' },
    { loc: '/about',           changefreq: 'monthly', priority: '0.5' },
    { loc: '/top-earners',     changefreq: 'daily',   priority: '0.6' },
    { loc: '/partner',         changefreq: 'monthly', priority: '0.5' },
    { loc: '/contact',         changefreq: 'monthly', priority: '0.4' },
    { loc: '/terms',           changefreq: 'yearly',  priority: '0.3' },
    { loc: '/privacy',         changefreq: 'yearly',  priority: '0.3' },
    { loc: '/refund',          changefreq: 'yearly',  priority: '0.3' },
  ];
  staticPages.forEach(p => urls.push({ ...p, lastmod: new Date().toISOString().split('T')[0] }));

  // Dynamic: Stores
  try {
    const stores = await db.query('SELECT slug, created_at AS updated_at FROM stores WHERE is_active = 1');
    stores.forEach(s => urls.push({
      loc: `/store/${s.slug}`,
      lastmod: formatDate(s.updated_at),
      changefreq: 'daily',
      priority: '0.8'
    }));
  } catch (e) { console.warn('Sitemap: stores fetch failed', e.message); }

  // Dynamic: Deals
  try {
    const deals = await db.query('SELECT id, updated_at FROM deals WHERE is_active = 1');
    deals.forEach(d => urls.push({
      loc: `/deal/${d.id}`,
      lastmod: formatDate(d.updated_at),
      changefreq: 'daily',
      priority: '0.7'
    }));
  } catch (e) { console.warn('Sitemap: deals fetch failed', e.message); }

  // Dynamic: Blog posts
  try {
    const posts = await db.query('SELECT slug, updated_at FROM blog_posts WHERE is_published = 1');
    posts.forEach(b => urls.push({
      loc: `/blog/${b.slug}`,
      lastmod: formatDate(b.updated_at),
      changefreq: 'monthly',
      priority: '0.6'
    }));
  } catch (e) { console.warn('Sitemap: blog fetch failed', e.message); }

  const xml = buildXml(urls);
  const outPath = path.join(__dirname, 'public', 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(`✅ Sitemap generated with ${urls.length} URLs → ${outPath}`);
}

function formatDate(d) {
  if (!d) return new Date().toISOString().split('T')[0];
  return new Date(d).toISOString().split('T')[0];
}

function buildXml(urls) {
  const items = urls.map(u => `  <url>
    <loc>${BASE_URL}${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;
}

generateSitemap().catch(err => {
  console.error('❌ Sitemap generation failed:', err);
  process.exit(1);
});
