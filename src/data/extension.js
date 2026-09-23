'use strict';

/**
 * The Zap browser extension release this site serves.
 *
 * Single source of truth: the /zap page, the download link and the update
 * banner inside already-installed copies all read from here. Zap is not on
 * the Chrome Web Store, so it has no auto-update channel — bumping `version`
 * here is how an installed copy learns a newer build exists. Ship the matching
 * zip to public/downloads/ in the same commit.
 */
module.exports = {
  version: '0.5.0',
  url: 'https://indiaoffers.in/zap',
  notes: 'Deals, bank offers and fast checkout in one place.',
  download: '/downloads/zap-0.5.0.zip',
  minChrome: 114
};
