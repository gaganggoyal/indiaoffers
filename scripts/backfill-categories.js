'use strict';

/**
 * One-off (re-runnable) backfill: assign every deal a primary `category` leaf
 * slug and a comma-wrapped `seo_categories` list from its title, using the
 * shared rule-based categoriser. Safe to run repeatedly — it just recomputes.
 *
 *   node scripts/backfill-categories.js          # apply
 *   node scripts/backfill-categories.js --dry     # preview only, no writes
 *
 * Honours DB_DRIVER (.env): sqlite locally, mysql in production.
 */

const db = require('../src/db');
const { categorize } = require('../src/data/categorize');

const DRY = process.argv.includes('--dry');

(async () => {
  const deals = await db.query('SELECT id, title FROM deals');
  let changed = 0;
  const dist = {};

  for (const d of deals) {
    const { primary, seo } = categorize(d.title);
    // Store SEO leaves comma-wrapped (",a,b,") so `LIKE '%,slug,%'` is exact.
    const seoStr = seo.length ? `,${seo.join(',')},` : '';
    dist[primary] = (dist[primary] || 0) + 1;
    if (!DRY) {
      await db.query('UPDATE deals SET category = ?, seo_categories = ?, updated_at = NOW() WHERE id = ?',
        [primary, seoStr, d.id]);
    }
    changed++;
  }

  console.log(`${DRY ? '[dry-run] would update' : 'Updated'} ${changed} deals.`);
  console.log('Primary distribution:');
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(3)}  ${k}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
