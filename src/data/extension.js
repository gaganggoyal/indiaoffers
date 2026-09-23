'use strict';

/**
 * The AmaFast browser extension release this site serves.
 *
 * Single source of truth: the /amafast page, the download link and the update
 * banner inside already-installed copies all read from here. AmaFast is not on
 * the Chrome Web Store, so it has no auto-update channel — bumping `version`
 * here is how an installed copy learns a newer build exists. Ship the matching
 * zip to public/downloads/ in the same commit.
 */
module.exports = {
  version: '0.4.3',
  url: 'https://indiaoffers.in/amafast',
  notes: 'Browse more Amazon deals straight from the popup.',
  download: '/downloads/amafast-0.4.3.zip',
  minChrome: 114
};
