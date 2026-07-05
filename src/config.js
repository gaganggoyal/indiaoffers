'use strict';

require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  isProd: process.env.NODE_ENV === 'production',
  siteUrl: process.env.SITE_URL || 'https://indiaoffers.in',
  siteName: 'IndiaOffers.in',
  jwtSecret: process.env.JWT_SECRET || 'dev_only_change_in_production',

  db: {
    driver: (process.env.DB_DRIVER || 'sqlite').toLowerCase(),
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'indiaoffers'
  },

  affiliate: {
    amazonTag: process.env.AMAZON_ASSOCIATE_TAG || 'indiaoffers-21',
    flipkartAffid: process.env.FLIPKART_AFFILIATE_ID || 'indiaoffers'
  }
};
