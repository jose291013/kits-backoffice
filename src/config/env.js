module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  presseroBaseUrl: process.env.PRESSERO_BASE_URL,
  presseroSiteDomain: process.env.PRESSERO_SITE_DOMAIN,
  presseroUsername: process.env.PRESSERO_USERNAME,
  presseroPassword: process.env.PRESSERO_PASSWORD,
  adminApiKey: process.env.ADMIN_API_KEY
};