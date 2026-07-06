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
  },

  // Outbound email for user alerts. With SMTP_HOST set we send real mail via
  // nodemailer; otherwise the mailer runs in "log" mode (emails are printed, not
  // sent) so the feature works end-to-end in dev without any credentials.
  mail: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: /^(1|true|yes)$/i.test(process.env.SMTP_SECURE || ''),   // true for port 465
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'IndiaOffers <alerts@indiaoffers.in>'
  },

  alerts: {
    autoSend: /^(1|true|yes)$/i.test(process.env.ALERTS_AUTO_SEND || ''),
    intervalMin: Math.max(1, parseInt(process.env.ALERTS_SEND_INTERVAL_MIN || '5', 10))
  }
};
