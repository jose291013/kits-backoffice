module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  presseroBaseUrl: process.env.PRESSERO_BASE_URL,
  presseroProductSiteDomain: process.env.PRESSERO_PRODUCT_SITE_DOMAIN,
  presseroCartSiteDomain: process.env.PRESSERO_CART_SITE_DOMAIN,
  presseroUsername: process.env.PRESSERO_USERNAME,
  presseroPassword: process.env.PRESSERO_PASSWORD,
  presseroSubscriberId: process.env.PRESSERO_SUBSCRIBER_ID,
  presseroConsumerId: process.env.PRESSERO_CONSUMER_ID,
  adminApiKey: process.env.ADMIN_API_KEY
};