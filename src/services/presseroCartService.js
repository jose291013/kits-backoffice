const axios = require("axios");
const env = require("../config/env");
const presseroService = require("./presseroService");

function getTokenHeaders(token) {
  return {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
    "Accept-Language": "en-US",
    Accept: "application/json"
  };
}

async function getOrCreateCartId(userId) {
  const token = await presseroService.authenticate();

  const url = `${env.presseroBaseUrl}/api/cart/${env.presseroCartSiteDomain}/?userId=${encodeURIComponent(userId)}`;

  const response = await axios.get(url, {
    headers: getTokenHeaders(token)
  });

  const data = response.data || {};

  const cartId =
    data.CartId ||
    data.cartId ||
    data.Id ||
    data.id ||
    null;

  if (!cartId) {
    throw new Error("Impossible de récupérer le CartId Pressero");
  }

  return cartId;
}

async function addProductToCart(userId, component, quantity) {
  const token = await presseroService.authenticate();
  const cartId = await getOrCreateCartId(userId);

  const url =
    `${env.presseroBaseUrl}/api/cart/${env.presseroCartSiteDomain}/${encodeURIComponent(cartId)}/item/?userId=${encodeURIComponent(userId)}`;

  const payload = {
    ProductId: component.product_id,
    Quantities: [
      Number(quantity || 0),
      Number(component.q2_standard_quotation || 0),
      Number(component.q3_height || 0),
      Number(component.q4_width || 0)
    ],
    Options: []
  };

  const response = await axios.post(url, payload, {
    headers: getTokenHeaders(token)
  });

  return {
    cartId,
    raw: response.data || null
  };
}

module.exports = {
  getOrCreateCartId,
  addProductToCart
};